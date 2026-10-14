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
	"archive/zip"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
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

const subdlApiKey = "subdl_jnzfk9ztPjamioVbgy89P46LwXkbRyQcTlNgrQakOI4"

type SubdlResponse struct {
	Status    bool `json:"status"`
	Subtitles []struct {
		ReleaseName string `json:"release_name"`
		Name        string `json:"name"`
		Lang        string `json:"lang"`
		Language    string `json:"language"`
		URL         string `json:"url"`
		Season      int    `json:"season"`
		Episode     int    `json:"episode"`
	} `json:"subtitles"`
}

type OsSubtitle struct {
	SubLanguageID   string `json:"SubLanguageID"`
	SubDownloadLink string `json:"SubDownloadLink"`
	SubFileName     string `json:"SubFileName"`
}

func fetchFromSubdl(cleanImdb string, season int, episode int, releaseName string) ([]byte, error) {
	client := &http.Client{Timeout: 8 * time.Second}

	reqUrl := fmt.Sprintf("https://api.subdl.com/api/v1/subtitles?api_key=%s&imdb_id=%s&languages=EN", subdlApiKey, cleanImdb)
	if season > 0 && episode > 0 {
		reqUrl += fmt.Sprintf("&season_number=%d&episode_number=%d&type=tv", season, episode)
	} else if season > 0 {
		reqUrl += fmt.Sprintf("&season_number=%d&type=tv", season)
	}

	resp, err := client.Get(reqUrl)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var subdlResp SubdlResponse
	if err := json.NewDecoder(resp.Body).Decode(&subdlResp); err != nil {
		return nil, err
	}

	if !subdlResp.Status || len(subdlResp.Subtitles) == 0 {
		return nil, fmt.Errorf("no subtitles found on SubDL")
	}

	var bestSub *struct {
		ReleaseName string `json:"release_name"`
		Name        string `json:"name"`
		Lang        string `json:"lang"`
		Language    string `json:"language"`
		URL         string `json:"url"`
		Season      int    `json:"season"`
		Episode     int    `json:"episode"`
	}

	normTarget := strings.ToLower(releaseName)
	bestScore := -1

	for i := range subdlResp.Subtitles {
		sub := &subdlResp.Subtitles[i]
		isEng := strings.EqualFold(sub.Language, "EN") || strings.Contains(strings.ToLower(sub.Lang), "english")
		if !isEng {
			continue
		}

		score := 0
		normSub := strings.ToLower(sub.ReleaseName + " " + sub.Name)
		if len(normTarget) > 0 {
			tokens := strings.FieldsFunc(normTarget, func(r rune) bool {
				return r == '.' || r == ' ' || r == '-' || r == '_'
			})
			for _, tok := range tokens {
				if len(tok) >= 3 && strings.Contains(normSub, tok) {
					score += 5
				}
			}
		}

		if score > bestScore {
			bestScore = score
			bestSub = sub
		}
	}

	if bestSub == nil {
		return nil, fmt.Errorf("no English subtitles found on SubDL")
	}

	downloadUrl := bestSub.URL
	if !strings.HasPrefix(downloadUrl, "http") {
		downloadUrl = "https://dl.subdl.com" + downloadUrl
	}

	dlResp, err := client.Get(downloadUrl)
	if err != nil {
		return nil, err
	}
	defer dlResp.Body.Close()

	zipData, err := io.ReadAll(dlResp.Body)
	if err != nil {
		return nil, err
	}

	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid zip data: %v", err)
	}

	var bestFile *zip.File
	bestFileScore := -1
	for _, f := range zipReader.File {
		lowerName := strings.ToLower(f.Name)
		if !strings.HasSuffix(lowerName, ".srt") && !strings.HasSuffix(lowerName, ".vtt") {
			continue
		}
		score := 0
		if len(normTarget) > 0 {
			tokens := strings.FieldsFunc(normTarget, func(r rune) bool {
				return r == '.' || r == ' ' || r == '-' || r == '_'
			})
			for _, tok := range tokens {
				if len(tok) >= 3 && strings.Contains(lowerName, tok) {
					score += 5
				}
			}
		}
		if score > bestFileScore {
			bestFileScore = score
			bestFile = f
		}
	}

	if bestFile == nil {
		return nil, fmt.Errorf("no srt found in SubDL zip")
	}

	rc, err := bestFile.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	return io.ReadAll(rc)
}

func fetchFromOpenSubtitles(cleanImdb string, season int, episode int) ([]byte, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	cleanDigits := strings.TrimPrefix(strings.TrimSpace(cleanImdb), "tt")

	var reqUrl string
	if season > 0 && episode > 0 {
		reqUrl = fmt.Sprintf("https://rest.opensubtitles.org/search/episode-%d/imdbid-%s/season-%d/sublanguageid-eng", episode, cleanDigits, season)
	} else {
		reqUrl = fmt.Sprintf("https://rest.opensubtitles.org/search/imdbid-%s/sublanguageid-eng", cleanDigits)
	}

	req, err := http.NewRequest("GET", reqUrl, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "TrovaPlayer v1.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var list []OsSubtitle
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil, err
	}

	if len(list) == 0 || list[0].SubDownloadLink == "" {
		return nil, fmt.Errorf("no English subtitles found on OpenSubtitles")
	}

	dlResp, err := client.Get(list[0].SubDownloadLink)
	if err != nil {
		return nil, err
	}
	defer dlResp.Body.Close()

	gzReader, err := gzip.NewReader(dlResp.Body)
	if err != nil {
		return nil, err
	}
	defer gzReader.Close()

	return io.ReadAll(gzReader)
}

func resolveAndCacheSubtitle(imdb string, season int, episode int, releaseName string) (string, string, string, error) {
	cleanImdb := strings.TrimSpace(imdb)
	if !strings.HasPrefix(cleanImdb, "tt") && len(cleanImdb) > 0 {
		cleanImdb = "tt" + cleanImdb
	}

	var filename string
	if season > 0 && episode > 0 {
		filename = fmt.Sprintf("%s_s%d_e%d.srt", cleanImdb, season, episode)
	} else if season > 0 {
		filename = fmt.Sprintf("%s_s%d.srt", cleanImdb, season)
	} else {
		filename = fmt.Sprintf("%s.srt", cleanImdb)
	}

	subDir := filepath.Join(cachePath, "subtitles")
	os.MkdirAll(subDir, 0755)
	cachedPath := filepath.Join(subDir, filename)

	if fi, err := os.Stat(cachedPath); err == nil && fi.Size() > 0 {
		return cachedPath, filename, "cache", nil
	}

	// 1. Primary: SubDL
	srtBytes, err := fetchFromSubdl(cleanImdb, season, episode, releaseName)
	if err == nil && len(srtBytes) > 0 {
		if writeErr := os.WriteFile(cachedPath, srtBytes, 0644); writeErr == nil {
			logInfo("Cached English subtitle from SubDL for %s (%d bytes)", filename, len(srtBytes))
			return cachedPath, filename, "subdl", nil
		}
	} else {
		logInfo("SubDL fetch failed or no English subs: %v", err)
	}

	// 2. Fallback: OpenSubtitles
	srtBytes, err = fetchFromOpenSubtitles(cleanImdb, season, episode)
	if err == nil && len(srtBytes) > 0 {
		if writeErr := os.WriteFile(cachedPath, srtBytes, 0644); writeErr == nil {
			logInfo("Cached English subtitle from OpenSubtitles for %s (%d bytes)", filename, len(srtBytes))
			return cachedPath, filename, "opensubtitles", nil
		}
	} else {
		logInfo("OpenSubtitles fetch failed or no English subs: %v", err)
	}

	return "", "", "", fmt.Errorf("no English subtitles found for %s", filename)
}

func subtitleFileHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")

	filename := strings.TrimPrefix(r.URL.Path, "/subtitles/")
	if filename == "" {
		http.Error(w, "missing subtitle filename", http.StatusBadRequest)
		return
	}

	subDir := filepath.Join(cachePath, "subtitles")
	filePath := filepath.Join(subDir, filename)

	if fi, err := os.Stat(filePath); err == nil && fi.Size() > 0 {
		http.ServeFile(w, r, filePath)
		return
	}

	base := strings.TrimSuffix(filename, filepath.Ext(filename))
	parts := strings.Split(base, "_")
	imdb := parts[0]
	season := 0
	episode := 0
	for _, p := range parts[1:] {
		if strings.HasPrefix(p, "s") {
			season, _ = strconv.Atoi(strings.TrimPrefix(p, "s"))
		} else if strings.HasPrefix(p, "e") {
			episode, _ = strconv.Atoi(strings.TrimPrefix(p, "e"))
		}
	}

	cachedPath, _, _, err := resolveAndCacheSubtitle(imdb, season, episode, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	http.ServeFile(w, r, cachedPath)
}

func subtitleFetchHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	imdb := r.URL.Query().Get("imdb")
	if imdb == "" {
		http.Error(w, `{"status":false,"error":"missing imdb parameter"}`, http.StatusBadRequest)
		return
	}

	season, _ := strconv.Atoi(r.URL.Query().Get("season"))
	episode, _ := strconv.Atoi(r.URL.Query().Get("episode"))
	title := r.URL.Query().Get("title")

	cachedPath, filename, source, err := resolveAndCacheSubtitle(imdb, season, episode, title)
	if err != nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": false,
			"error":  err.Error(),
		})
		return
	}

	subUrl := fmt.Sprintf("http://127.0.0.1:%d/subtitles/%s", listenPort, filename)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   true,
		"source":   source,
		"filename": filename,
		"url":      subUrl,
		"path":     cachedPath,
	})
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
		mux.HandleFunc("/subtitles/", subtitleFileHandler)
		mux.HandleFunc("/fetch-subtitle", subtitleFetchHandler)
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
