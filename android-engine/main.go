package main

/*
#cgo LDFLAGS: -llog
#include <stdlib.h>
#include <android/log.h>

static void android_log_info(const char* tag, const char* msg) {
    __android_log_print(ANDROID_LOG_INFO, tag, "%s", msg);
}
static void android_log_error(const char* tag, const char* msg) {
    __android_log_print(ANDROID_LOG_ERROR, tag, "%s", msg);
}
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
	"unsafe"

	"github.com/anacrolix/torrent"
)

func logInfo(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("[TorrentEngine] " + msg)
	cTag := C.CString("TorrentStreamerEngine")
	cMsg := C.CString(msg)
	C.android_log_info(cTag, cMsg)
	C.free(unsafe.Pointer(cTag))
	C.free(unsafe.Pointer(cMsg))
}

func logError(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("[TorrentEngine ERROR] " + msg)
	cTag := C.CString("TorrentStreamerEngine")
	cMsg := C.CString(msg)
	C.android_log_error(cTag, cMsg)
	C.free(unsafe.Pointer(cTag))
	C.free(unsafe.Pointer(cMsg))
}

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

	// Quick check if metadata is ready (up to 12s)
	select {
	case <-t.GotInfo():
		targetFile := getLargestVideoFile(t)
		var filename string
		var length int64
		if targetFile != nil {
			filename = filepath.Base(targetFile.Path())
			length = targetFile.Length()
		}
		logInfo("preload ready: %s (%d bytes)", filename, length)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "ready",
			"filename": filename,
			"size":     length,
		})
	case <-time.After(12 * time.Second):
		logInfo("preload: resolving peers in background")
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

	logInfo("streamHandler: received stream request")
	t, err := getOrCreateTorrent(magnet)
	if err != nil {
		logError("streamHandler: failed to load magnet: %v", err)
		http.Error(w, fmt.Sprintf("failed to load magnet: %v", err), http.StatusBadRequest)
		return
	}

	// Wait up to 45 seconds for metadata resolution from swarm
	logInfo("streamHandler: waiting for torrent metadata from swarm (45s timeout)...")
	select {
	case <-t.GotInfo():
		logInfo("streamHandler: torrent metadata resolved! Total files: %d", len(t.Files()))
	case <-time.After(45 * time.Second):
		logError("streamHandler: timed out fetching torrent metadata from swarm after 45s")
		http.Error(w, "timed out fetching torrent metadata from swarm", http.StatusGatewayTimeout)
		return
	case <-r.Context().Done():
		logInfo("streamHandler: client cancelled request during metadata wait")
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
		logError("streamHandler: no video file found in torrent")
		http.Error(w, "no video file found in torrent", http.StatusNotFound)
		return
	}

	logInfo("streamHandler: serving file '%s' (%d bytes)", filepath.Base(targetFile.Path()), targetFile.Length())

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
		logInfo("InitTorrentEngine: engine already running on port %d", listenPort)
		return 0
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
		logError("InitTorrentEngine: failed to create torrent client: %v", err)
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
			logInfo("HTTP server listening on %s", addr)
			if err := http.ListenAndServe(addr, mux); err != nil {
				logError("HTTP server error: %v", err)
			}
		}()
	})

	return 0
}

func main() {}
