package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/anacrolix/torrent"
)

var (
	clientLock sync.Mutex
	tClient    *torrent.Client
	serverOnce sync.Once
	cachePath  string
	listenPort = 8899
)

var fallbackTrackers = [][]string{
	{"udp://tracker.opentrackr.org:1337/announce"},
	{"udp://open.stealth.si:80/announce"},
	{"udp://tracker.torrent.eu.org:451/announce"},
	{"udp://tracker.openbittorrent.com:6969/announce"},
	{"http://tracker.openbittorrent.com:80/announce"},
	{"udp://explodie.org:6969/announce"},
	{"udp://tracker.cyberia.is:6969/announce"},
	{"udp://tracker.moeking.me:6969/announce"},
	{"udp://p4p.arenabg.com:1337/announce"},
}

func isVideoExt(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".mkv", ".mp4", ".avi", ".mov", ".webm", ".m4v", ".ts":
		return true
	}
	return false
}

func getLargestVideoFile(t *torrent.Torrent) *torrent.File {
	var largest *torrent.File
	var maxLen int64 = -1
	for _, f := range t.Files() {
		if isVideoExt(f.Path()) && f.Length() > maxLen {
			maxLen = f.Length()
			largest = f
		}
	}
	// Fallback to absolute largest file if no recognized video extension matched
	if largest == nil {
		for _, f := range t.Files() {
			if f.Length() > maxLen {
				maxLen = f.Length()
				largest = f
			}
		}
	}
	return largest
}

func getOrCreateTorrent(magnet string) (*torrent.Torrent, error) {
	clientLock.Lock()
	client := tClient
	clientLock.Unlock()

	if client == nil {
		return nil, fmt.Errorf("torrent client not initialized")
	}

	t, err := client.AddMagnet(magnet)
	if err != nil {
		return nil, err
	}

	// Inject fallback public trackers for resilience
	t.AddTrackers(fallbackTrackers)

	// Clean up previous torrents to conserve mobile memory and bandwidth
	for _, existing := range client.Torrents() {
		if existing.InfoHash() != t.InfoHash() {
			existing.Drop()
		}
	}

	return t, nil
}

func preloadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	magnet := r.URL.Query().Get("magnet")
	if magnet == "" {
		http.Error(w, `{"error":"missing magnet"}`, http.StatusBadRequest)
		return
	}

	t, err := getOrCreateTorrent(magnet)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusBadRequest)
		return
	}

	// Quick check if metadata is ready (up to 8s)
	select {
	case <-t.GotInfo():
		targetFile := getLargestVideoFile(t)
		var filename string
		var length int64
		if targetFile != nil {
			filename = filepath.Base(targetFile.Path())
			length = targetFile.Length()
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "ready",
			"filename": filename,
			"size":     length,
		})
	case <-time.After(8 * time.Second):
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "resolving_peers",
		})
	case <-r.Context().Done():
		return
	}
}

func streamHandler(w http.ResponseWriter, r *http.Request) {
	magnet := r.URL.Query().Get("magnet")
	if magnet == "" {
		http.Error(w, "missing magnet query parameter", http.StatusBadRequest)
		return
	}

	t, err := getOrCreateTorrent(magnet)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to load magnet: %v", err), http.StatusBadRequest)
		return
	}

	// Wait up to 15 seconds for metadata resolution
	select {
	case <-t.GotInfo():
	case <-time.After(15 * time.Second):
		http.Error(w, "timed out fetching torrent metadata from swarm", http.StatusGatewayTimeout)
		return
	case <-r.Context().Done():
		return
	}

	var targetFile *torrent.File
	fileIdxStr := r.URL.Query().Get("fileIdx")
	if fileIdxStr != "" {
		var idx int
		if _, err := fmt.Sscanf(fileIdxStr, "%d", &idx); err == nil {
			files := t.Files()
			if idx >= 0 && idx < len(files) {
				targetFile = files[idx]
			}
		}
	}
	if targetFile == nil {
		targetFile = getLargestVideoFile(t)
	}
	if targetFile == nil {
		http.Error(w, "no video file found in torrent", http.StatusNotFound)
		return
	}

	// Begin downloading file chunks
	targetFile.Download()

	reader := targetFile.NewReader()
	defer reader.Close()

	// Enable instant chunk streaming without waiting for complete piece hash
	reader.SetResponsive()
	// 15 MB readahead buffer for smooth mobile streaming
	reader.SetReadahead(15 * 1024 * 1024)

	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filepath.Base(targetFile.Path())))
	w.Header().Set("Accept-Ranges", "bytes")

	ext := strings.ToLower(filepath.Ext(targetFile.Path()))
	switch ext {
	case ".mkv":
		w.Header().Set("Content-Type", "video/x-matroska")
	case ".mp4":
		w.Header().Set("Content-Type", "video/mp4")
	case ".webm":
		w.Header().Set("Content-Type", "video/webm")
	default:
		w.Header().Set("Content-Type", "video/any")
	}

	http.ServeContent(w, r, filepath.Base(targetFile.Path()), time.Time{}, reader)
}

//export InitTorrentEngine
func InitTorrentEngine(storageDir *C.char, port C.int) C.int {
	clientLock.Lock()
	defer clientLock.Unlock()

	cachePath = C.GoString(storageDir)
	if port > 0 {
		listenPort = int(port)
	}

	if tClient != nil {
		return 0 // already initialized
	}

	os.MkdirAll(cachePath, 0755)

	cfg := torrent.NewDefaultClientConfig()
	cfg.DataDir = cachePath
	cfg.NoUpload = false
	cfg.Seed = false
	cfg.EstablishedConnsPerTorrent = 40
	cfg.HalfOpenConnsPerTorrent = 20

	var err error
	tClient, err = torrent.NewClient(cfg)
	if err != nil {
		log.Printf("[TorrentEngine] failed to create client: %v", err)
		return -1
	}

	serverOnce.Do(func() {
		mux := http.NewServeMux()
		mux.HandleFunc("/stream", streamHandler)
		mux.HandleFunc("/preload", preloadHandler)
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"ok","engine":"trova-torrent-streamer"}`))
		})

		addr := fmt.Sprintf("127.0.0.1:%d", listenPort)
		go func() {
			log.Printf("[TorrentEngine] HTTP server listening on %s", addr)
			if err := http.ListenAndServe(addr, mux); err != nil {
				log.Printf("[TorrentEngine] server error: %v", err)
			}
		}()
	})

	return 0
}

func main() {}
