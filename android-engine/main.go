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
	"regexp"
	"sort"
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
	clientLock    sync.Mutex
	tClient       *torrent.Client
	serverOnce    sync.Once
	cachePath     string
	listenPort    = 8899
	downloadsLock sync.Mutex
	downloads     = make(map[string]*DownloadEntry)
)

const MaxDownloadQuotaBytes = int64(75) * 1024 * 1024 * 1024 // 75 GB

type DownloadEntry struct {
	ID             string            `json:"id"`
	InfoHash       string            `json:"infoHash"`
	Magnet         string            `json:"magnet"`
	FileIdx        int               `json:"fileIdx"`
	Title          string            `json:"title"`
	ReleaseName    string            `json:"releaseName"`
	MediaType      string            `json:"mediaType"`
	TmdbID         int               `json:"tmdbId"`
	ImdbID         string            `json:"imdbId"`
	Year           string            `json:"year"`
	PosterURL      string            `json:"posterUrl"`
	Season         int               `json:"season,omitempty"`
	Episode        int               `json:"episode,omitempty"`
	EpisodeTitle   string            `json:"episodeTitle,omitempty"`
	EpisodeTitles  map[string]string `json:"episodeTitles,omitempty"`
	Quality        string            `json:"quality,omitempty"`
	Codec          string            `json:"codec,omitempty"`
	FilePath       string            `json:"filePath"`
	RelativePath   string            `json:"relativePath"`
	RootDir        string            `json:"rootDir"`
	Filename       string            `json:"filename"`
	SubtitleURL    string            `json:"subtitleUrl,omitempty"`
	SubtitlePath   string            `json:"subtitlePath,omitempty"`
	TotalBytes     int64             `json:"totalBytes"`
	CompletedBytes int64             `json:"completedBytes"`
	Progress       float64           `json:"progress"`
	SpeedBps       int64             `json:"speedBps"`
	Peers          int               `json:"peers"`
	State          string            `json:"state"` // "resolving", "downloading", "paused", "completed", "error"
	ErrorMsg       string            `json:"error,omitempty"`
	CreatedAt      int64             `json:"createdAt"`
	CompletedAt    int64             `json:"completedAt,omitempty"`

	lastBytes      int64
	lastSampleTime time.Time
}

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

var (
	reSxE      = regexp.MustCompile(`(?i)\bs(\d{1,2})[\s._-]*e(\d{1,3})\b`)
	reNxN      = regexp.MustCompile(`(?i)\b(\d{1,2})x(\d{1,3})\b`)
	reSeasonEp = regexp.MustCompile(`(?i)\bseason[\s._-]*(\d{1,2})[\s._-]*episode[\s._-]*(\d{1,3})\b`)
	reEpOnly   = regexp.MustCompile(`(?i)\b(?:ep|episode|e)[\s._-]*(\d{1,3})\b`)
)

func parseSeasonEpisodeFromName(name string, defaultSeason int) (int, int, bool) {
	if m := reSxE.FindStringSubmatch(name); len(m) == 3 {
		s, _ := strconv.Atoi(m[1])
		e, _ := strconv.Atoi(m[2])
		if s > 0 && e > 0 {
			return s, e, true
		}
	}
	if m := reNxN.FindStringSubmatch(name); len(m) == 3 {
		s, _ := strconv.Atoi(m[1])
		e, _ := strconv.Atoi(m[2])
		if s > 0 && e > 0 {
			return s, e, true
		}
	}
	if m := reSeasonEp.FindStringSubmatch(name); len(m) == 3 {
		s, _ := strconv.Atoi(m[1])
		e, _ := strconv.Atoi(m[2])
		if s > 0 && e > 0 {
			return s, e, true
		}
	}
	if defaultSeason > 0 {
		if m := reEpOnly.FindStringSubmatch(name); len(m) == 2 {
			e, _ := strconv.Atoi(m[1])
			if e > 0 && e < 200 && e != 264 && e != 265 {
				return defaultSeason, e, true
			}
		}
	}
	return 0, 0, false
}

type seasonPackFileTarget struct {
	Episode int
	FileIdx int
	File    *torrent.File
}

func extractSeasonPackFiles(t *torrent.Torrent, targetSeason int) []seasonPackFileTarget {
	files := t.Files()
	type candidate struct {
		idx     int
		file    *torrent.File
		season  int
		episode int
		matched bool
	}
	var candidates []candidate
	hasExplicitMatch := false

	for idx, f := range files {
		p := f.Path()
		if !isVideoExt(p) {
			continue
		}
		lower := strings.ToLower(filepath.ToSlash(p))
		baseLower := strings.ToLower(filepath.Base(p))
		if strings.Contains(baseLower, "sample") || strings.Contains(lower, "/sample/") || strings.Contains(lower, "/extras/") || strings.Contains(lower, "/featurettes/") {
			continue
		}
		if f.Length() < 5*1024*1024 {
			continue
		}

		s, e, ok := parseSeasonEpisodeFromName(filepath.Base(p), targetSeason)
		if !ok {
			s, e, ok = parseSeasonEpisodeFromName(p, targetSeason)
		}
		if ok && (targetSeason <= 0 || s == targetSeason) && e > 0 {
			hasExplicitMatch = true
			candidates = append(candidates, candidate{
				idx:     idx,
				file:    f,
				season:  s,
				episode: e,
				matched: true,
			})
		} else if !ok {
			candidates = append(candidates, candidate{
				idx:     idx,
				file:    f,
				season:  targetSeason,
				episode: 0,
				matched: false,
			})
		}
	}

	if hasExplicitMatch {
		byEp := make(map[int]candidate)
		for _, c := range candidates {
			if !c.matched || c.episode <= 0 {
				continue
			}
			if existing, exists := byEp[c.episode]; !exists || c.file.Length() > existing.file.Length() {
				byEp[c.episode] = c
			}
		}
		results := make([]seasonPackFileTarget, 0, len(byEp))
		for _, c := range byEp {
			results = append(results, seasonPackFileTarget{
				Episode: c.episode,
				FileIdx: c.idx,
				File:    c.file,
			})
		}
		sort.Slice(results, func(i, j int) bool {
			return results[i].Episode < results[j].Episode
		})
		return results
	}

	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].file.Path() < candidates[j].file.Path()
	})
	results := make([]seasonPackFileTarget, 0, len(candidates))
	for i, c := range candidates {
		results = append(results, seasonPackFileTarget{
			Episode: i + 1,
			FileIdx: c.idx,
			File:    c.file,
		})
	}
	return results
}

func getLargestVideoFile(t *torrent.Torrent) (*torrent.File, int) {
	var largest *torrent.File
	largestIdx := -1
	var maxLen int64 = -1
	for idx, f := range t.Files() {
		if isVideoExt(f.Path()) && f.Length() > maxLen {
			maxLen = f.Length()
			largest = f
			largestIdx = idx
		}
	}
	// Fallback to absolute largest file if no recognized video extension matched
	if largest == nil {
		for idx, f := range t.Files() {
			if f.Length() > maxLen {
				maxLen = f.Length()
				largest = f
				largestIdx = idx
			}
		}
	}
	return largest, largestIdx
}

func selectTargetVideoFile(t *torrent.Torrent, fileIdx int, season int, episode int) (*torrent.File, int) {
	files := t.Files()
	if fileIdx >= 0 && fileIdx < len(files) {
		return files[fileIdx], fileIdx
	}
	if season > 0 && episode > 0 {
		for idx, f := range files {
			if !isVideoExt(f.Path()) {
				continue
			}
			s, e, ok := parseSeasonEpisodeFromName(filepath.Base(f.Path()), season)
			if !ok {
				s, e, ok = parseSeasonEpisodeFromName(f.Path(), season)
			}
			if ok && s == season && e == episode {
				return f, idx
			}
		}
	}
	if season > 0 && episode == 0 {
		packFiles := extractSeasonPackFiles(t, season)
		if len(packFiles) > 0 {
			return packFiles[0].File, packFiles[0].FileIdx
		}
	}
	return getLargestVideoFile(t)
}

func isProtectedInfoHash(infoHash string) bool {
	downloadsLock.Lock()
	defer downloadsLock.Unlock()
	for _, d := range downloads {
		if strings.EqualFold(d.InfoHash, infoHash) && (d.State == "downloading" || d.State == "resolving") {
			return true
		}
	}
	return false
}

func downloadsIndexPath() string {
	return filepath.Join(cachePath, "downloads_index.json")
}

func saveDownloadsIndexLocked() {
	if cachePath == "" {
		return
	}
	list := make([]*DownloadEntry, 0, len(downloads))
	for _, d := range downloads {
		list = append(list, d)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		logError("saveDownloadsIndexLocked marshal error: %v", err)
		return
	}
	tmpPath := downloadsIndexPath() + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err == nil {
		_ = os.Rename(tmpPath, downloadsIndexPath())
	}
}

func loadDownloadsIndex() {
	downloadsLock.Lock()
	defer downloadsLock.Unlock()

	data, err := os.ReadFile(downloadsIndexPath())
	if err != nil {
		return
	}
	var list []*DownloadEntry
	if err := json.Unmarshal(data, &list); err != nil {
		logError("loadDownloadsIndex unmarshal error: %v", err)
		return
	}
	for _, entry := range list {
		if entry == nil || entry.ID == "" {
			continue
		}
		entry.SpeedBps = 0
		entry.Peers = 0
		if entry.Season > 0 && entry.Episode == 0 && entry.Magnet != "" {
			// Legacy unexpanded season pack: re-resolve and expand into all season episodes
			entry.FileIdx = -1
			entry.State = "resolving"
			downloads[entry.ID] = entry
			continue
		}
		if entry.State == "completed" {
			if entry.FilePath != "" {
				if fi, statErr := os.Stat(entry.FilePath); statErr == nil && fi.Size() > 0 {
					entry.CompletedBytes = fi.Size()
					entry.TotalBytes = fi.Size()
					entry.Progress = 1.0
					downloads[entry.ID] = entry
				}
			}
		} else {
			if entry.State == "downloading" || entry.State == "resolving" {
				entry.State = "paused"
			}
			downloads[entry.ID] = entry
		}
	}
	saveDownloadsIndexLocked()
}

func computeUsedBytesLocked() int64 {
	var used int64
	for _, d := range downloads {
		if d.CompletedBytes > 0 {
			used += d.CompletedBytes
		} else if d.FilePath != "" {
			if fi, err := os.Stat(d.FilePath); err == nil {
				used += fi.Size()
			}
		}
	}
	return used
}

func getOrCreateTorrent(magnet string, keepExisting bool) (*torrent.Torrent, error) {
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

	if !keepExisting {
		// Clean up previous ephemeral stream torrents while preserving active downloads
		for _, existing := range client.Torrents() {
			if existing.InfoHash() != t.InfoHash() && !isProtectedInfoHash(existing.InfoHash().HexString()) {
				existing.Drop()
			}
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

	t, err := getOrCreateTorrent(magnet, false)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusBadRequest)
		return
	}

	// Quick check if metadata is ready (up to 12s)
	select {
	case <-t.GotInfo():
		targetFile, _ := getLargestVideoFile(t)
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

func writeVideoHeaders(w http.ResponseWriter, filename string) {
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filepath.Base(filename)))
	w.Header().Set("Accept-Ranges", "bytes")

	ext := strings.ToLower(filepath.Ext(filename))
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
}

func streamHandler(w http.ResponseWriter, r *http.Request) {
	magnet := r.URL.Query().Get("magnet")
	if magnet == "" {
		http.Error(w, "missing magnet query parameter", http.StatusBadRequest)
		return
	}

	logInfo("streamHandler: received stream request")
	t, err := getOrCreateTorrent(magnet, false)
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

	fileIdx := -1
	if fileIdxStr := r.URL.Query().Get("fileIdx"); fileIdxStr != "" {
		if parsed, err := strconv.Atoi(fileIdxStr); err == nil {
			fileIdx = parsed
		}
	}
	season, _ := strconv.Atoi(r.URL.Query().Get("season"))
	episode, _ := strconv.Atoi(r.URL.Query().Get("episode"))

	targetFile, _ := selectTargetVideoFile(t, fileIdx, season, episode)
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

	writeVideoHeaders(w, targetFile.Path())
	http.ServeContent(w, r, filepath.Base(targetFile.Path()), time.Time{}, reader)
}

func buildDownloadID(imdbID string, tmdbID int, season int, episode int, infoHash string, fileIdx int) string {
	base := strings.TrimSpace(imdbID)
	if base == "" && tmdbID > 0 {
		base = fmt.Sprintf("tmdb_%d", tmdbID)
	}
	if base == "" {
		base = infoHash
	}
	if season > 0 || episode > 0 {
		return fmt.Sprintf("%s_s%02de%02d", base, season, episode)
	}
	if fileIdx >= 0 {
		return fmt.Sprintf("%s_f%d", base, fileIdx)
	}
	return base
}

func cacheSubtitleForDownload(imdb string, s int, e int, rel string, dlID string) {
	if imdb == "" || dlID == "" {
		return
	}
	go func() {
		cachedPath, filename, _, subErr := resolveAndCacheSubtitle(imdb, s, e, rel)
		if subErr == nil && filename != "" {
			downloadsLock.Lock()
			if cur, ok := downloads[dlID]; ok {
				cur.SubtitleURL = fmt.Sprintf("http://127.0.0.1:%d/subtitles/%s", listenPort, filename)
				cur.SubtitlePath = cachedPath
				saveDownloadsIndexLocked()
			}
			downloadsLock.Unlock()
		}
	}()
}

func activateDownloadEntry(entry *DownloadEntry) {
	go func() {
		t, err := getOrCreateTorrent(entry.Magnet, true)
		if err != nil {
			downloadsLock.Lock()
			entry.State = "error"
			entry.ErrorMsg = fmt.Sprintf("Failed to add torrent: %v", err)
			saveDownloadsIndexLocked()
			downloadsLock.Unlock()
			return
		}

		infoHash := strings.ToLower(t.InfoHash().HexString())
		downloadsLock.Lock()
		entry.InfoHash = infoHash
		saveDownloadsIndexLocked()
		downloadsLock.Unlock()

		// Pre-cache English subtitle for single movie or single episode immediately
		if entry.ImdbID != "" && !(entry.Season > 0 && entry.Episode == 0 && entry.FileIdx < 0) {
			cacheSubtitleForDownload(entry.ImdbID, entry.Season, entry.Episode, entry.ReleaseName, entry.ID)
		}

		select {
		case <-t.GotInfo():
		case <-time.After(90 * time.Second):
			downloadsLock.Lock()
			if cur, ok := downloads[entry.ID]; ok && cur.State == "resolving" {
				cur.State = "error"
				cur.ErrorMsg = "Timed out resolving torrent metadata from peers"
				saveDownloadsIndexLocked()
			}
			downloadsLock.Unlock()
			return
		}

		downloadsLock.Lock()
		cur, exists := downloads[entry.ID]
		if !exists || cur.State == "paused" {
			downloadsLock.Unlock()
			return
		}

		// Season Pack expansion: when Season > 0 and Episode == 0 (no single fileIdx specified),
		// expand into individual download entries for every episode in the season pack!
		if cur.Season > 0 && cur.Episode == 0 && cur.FileIdx < 0 {
			packTargets := extractSeasonPackFiles(t, cur.Season)
			if len(packTargets) > 0 {
				var totalNeeded int64
				for _, pt := range packTargets {
					rem := pt.File.Length() - pt.File.BytesCompleted()
					if rem > 0 {
						totalNeeded += rem
					}
				}
				used := computeUsedBytesLocked() - cur.CompletedBytes
				if used < 0 {
					used = 0
				}
				if used+totalNeeded > MaxDownloadQuotaBytes {
					cur.State = "error"
					cur.ErrorMsg = "Insufficient Trova storage (75 GB limit reached). Delete a download to free space."
					saveDownloadsIndexLocked()
					downloadsLock.Unlock()
					if !isProtectedInfoHash(infoHash) {
						t.Drop()
					}
					return
				}

				type subTask struct {
					epNum int
					rel   string
					dlID  string
				}
				var subTasks []subTask
				var filesToDownload []*torrent.File

				for _, pt := range packTargets {
					epID := buildDownloadID(cur.ImdbID, cur.TmdbID, cur.Season, pt.Episode, infoHash, pt.FileIdx)
					epEntry, epExists := downloads[epID]
					if !epExists {
						epEntry = &DownloadEntry{
							ID:        epID,
							CreatedAt: time.Now().Unix(),
						}
						downloads[epID] = epEntry
					}
					epEntry.InfoHash = infoHash
					epEntry.Magnet = cur.Magnet
					epEntry.FileIdx = pt.FileIdx
					epEntry.Title = cur.Title
					epEntry.ReleaseName = cur.ReleaseName
					epEntry.MediaType = "tv"
					epEntry.TmdbID = cur.TmdbID
					epEntry.ImdbID = cur.ImdbID
					epEntry.Year = cur.Year
					epEntry.PosterURL = cur.PosterURL
					epEntry.Season = cur.Season
					epEntry.Episode = pt.Episode
					if cur.EpisodeTitles != nil {
						if epTitle, ok := cur.EpisodeTitles[strconv.Itoa(pt.Episode)]; ok && epTitle != "" {
							epEntry.EpisodeTitle = epTitle
						}
					}
					epEntry.Quality = cur.Quality
					epEntry.Codec = cur.Codec

					relPath := pt.File.Path()
					parts := strings.Split(filepath.ToSlash(relPath), "/")
					epEntry.RelativePath = relPath
					epEntry.RootDir = parts[0]
					epEntry.FilePath = filepath.Join(cachePath, relPath)
					epEntry.Filename = filepath.Base(relPath)
					epEntry.TotalBytes = pt.File.Length()
					epEntry.CompletedBytes = pt.File.BytesCompleted()
					if epEntry.TotalBytes > 0 {
						epEntry.Progress = float64(epEntry.CompletedBytes) / float64(epEntry.TotalBytes)
					}
					epEntry.lastBytes = epEntry.CompletedBytes
					epEntry.lastSampleTime = time.Now()
					epEntry.ErrorMsg = ""

					if epEntry.TotalBytes > 0 && epEntry.CompletedBytes >= epEntry.TotalBytes {
						epEntry.State = "completed"
						epEntry.Progress = 1.0
						epEntry.SpeedBps = 0
						if epEntry.CompletedAt == 0 {
							epEntry.CompletedAt = time.Now().Unix()
						}
					} else {
						epEntry.State = "downloading"
						filesToDownload = append(filesToDownload, pt.File)
					}

					if cur.ImdbID != "" {
						subTasks = append(subTasks, subTask{
							epNum: pt.Episode,
							rel:   epEntry.Filename,
							dlID:  epID,
						})
					}
				}

				// Remove placeholder sXXe00 entry once expanded into sXXe01..sXXeNN
				delete(downloads, cur.ID)
				saveDownloadsIndexLocked()
				imdbForSubs := cur.ImdbID
				seasonForSubs := cur.Season
				downloadsLock.Unlock()

				for _, st := range subTasks {
					cacheSubtitleForDownload(imdbForSubs, seasonForSubs, st.epNum, st.rel, st.dlID)
				}

				for i, f := range filesToDownload {
					f.Download()
					if i == 0 {
						f.SetPriority(torrent.PiecePriorityHigh)
					}
				}
				logInfo("Expanded season pack '%s' S%02d into %d episode downloads (%d active)", cur.Title, seasonForSubs, len(packTargets), len(filesToDownload))
				if len(filesToDownload) == 0 && !isProtectedInfoHash(infoHash) {
					t.Drop()
				}
				return
			}
		}

		targetFile, resolvedIdx := selectTargetVideoFile(t, cur.FileIdx, cur.Season, cur.Episode)
		cur.FileIdx = resolvedIdx

		if targetFile == nil {
			cur.State = "error"
			cur.ErrorMsg = "No video file found in torrent"
			saveDownloadsIndexLocked()
			downloadsLock.Unlock()
			return
		}

		fileLen := targetFile.Length()
		used := computeUsedBytesLocked() - cur.CompletedBytes
		if used < 0 {
			used = 0
		}
		if used+fileLen > MaxDownloadQuotaBytes {
			cur.State = "error"
			cur.ErrorMsg = "Insufficient Trova storage (75 GB limit reached). Delete a download to free space."
			saveDownloadsIndexLocked()
			downloadsLock.Unlock()
			if !isProtectedInfoHash(infoHash) {
				t.Drop()
			}
			return
		}

		relPath := targetFile.Path()
		parts := strings.Split(filepath.ToSlash(relPath), "/")
		rootDir := parts[0]

		cur.RelativePath = relPath
		cur.RootDir = rootDir
		cur.FilePath = filepath.Join(cachePath, relPath)
		cur.Filename = filepath.Base(relPath)
		cur.TotalBytes = fileLen
		cur.CompletedBytes = targetFile.BytesCompleted()
		if cur.TotalBytes > 0 {
			cur.Progress = float64(cur.CompletedBytes) / float64(cur.TotalBytes)
		}
		cur.lastBytes = cur.CompletedBytes
		cur.lastSampleTime = time.Now()

		if cur.TotalBytes > 0 && cur.CompletedBytes >= cur.TotalBytes {
			cur.State = "completed"
			cur.Progress = 1.0
			cur.SpeedBps = 0
			cur.CompletedAt = time.Now().Unix()
			saveDownloadsIndexLocked()
			downloadsLock.Unlock()
			if !isProtectedInfoHash(infoHash) {
				t.Drop()
			}
			return
		}

		cur.State = "downloading"
		cur.ErrorMsg = ""
		saveDownloadsIndexLocked()
		downloadsLock.Unlock()

		// Download all pieces of the target video file to persistent storage
		targetFile.Download()
		logInfo("Started full file download for '%s' (%d bytes) -> %s", cur.Title, cur.TotalBytes, cur.FilePath)
	}()
}

func runDownloadMonitor() {
	ticker := time.NewTicker(1500 * time.Millisecond)
	defer ticker.Stop()

	saveCounter := 0
	for range ticker.C {
		clientLock.Lock()
		client := tClient
		clientLock.Unlock()
		if client == nil {
			continue
		}

		downloadsLock.Lock()
		changed := false
		var completedHashes []string
		lowestActiveByHash := make(map[string]*torrent.File)
		lowestEpNumByHash := make(map[string]int)

		for _, d := range downloads {
			if d.State != "downloading" {
				continue
			}

			var matchedTorrent *torrent.Torrent
			for _, t := range client.Torrents() {
				if strings.EqualFold(t.InfoHash().HexString(), d.InfoHash) {
					matchedTorrent = t
					break
				}
			}
			if matchedTorrent == nil || matchedTorrent.Info() == nil {
				continue
			}

			targetFile, _ := selectTargetVideoFile(matchedTorrent, d.FileIdx, d.Season, d.Episode)
			if targetFile == nil {
				continue
			}

			now := time.Now()
			completed := targetFile.BytesCompleted()
			total := targetFile.Length()
			if total <= 0 {
				total = d.TotalBytes
			}

			elapsed := now.Sub(d.lastSampleTime).Seconds()
			if elapsed >= 0.5 {
				delta := completed - d.lastBytes
				if delta < 0 {
					delta = 0
				}
				d.SpeedBps = int64(float64(delta) / elapsed)
				d.lastBytes = completed
				d.lastSampleTime = now
			}

			d.CompletedBytes = completed
			d.TotalBytes = total
			if total > 0 {
				d.Progress = float64(completed) / float64(total)
				if d.Progress > 1.0 {
					d.Progress = 1.0
				}
			}
			stats := matchedTorrent.Stats()
			d.Peers = stats.ActivePeers
			changed = true

			if total > 0 && completed >= total {
				d.State = "completed"
				d.Progress = 1.0
				d.SpeedBps = 0
				d.Peers = 0
				d.CompletedAt = now.Unix()
				completedHashes = append(completedHashes, d.InfoHash)
				logInfo("Download completed: %s S%02dE%02d (%d bytes)", d.Title, d.Season, d.Episode, d.TotalBytes)
			} else if d.Episode > 0 && d.InfoHash != "" {
				hashKey := strings.ToLower(d.InfoHash)
				if prevEp, exists := lowestEpNumByHash[hashKey]; !exists || d.Episode < prevEp {
					lowestEpNumByHash[hashKey] = d.Episode
					lowestActiveByHash[hashKey] = targetFile
				}
			}
		}

		for _, priorityFile := range lowestActiveByHash {
			priorityFile.SetPriority(torrent.PiecePriorityHigh)
		}

		saveCounter++
		if changed && (len(completedHashes) > 0 || saveCounter%4 == 0) {
			saveDownloadsIndexLocked()
		}
		downloadsLock.Unlock()

		// Drop completed torrents that have no other active downloads
		for _, hash := range completedHashes {
			if !isProtectedInfoHash(hash) {
				for _, t := range client.Torrents() {
					if strings.EqualFold(t.InfoHash().HexString(), hash) {
						t.Drop()
					}
				}
			}
		}
	}
}

func downloadStartHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	var payload struct {
		ID            string            `json:"id"`
		Magnet        string            `json:"magnet"`
		InfoHash      string            `json:"infoHash"`
		FileIdx       *int              `json:"fileIdx"`
		Title         string            `json:"title"`
		ReleaseName   string            `json:"releaseName"`
		MediaType     string            `json:"mediaType"`
		TmdbID        int               `json:"tmdbId"`
		ImdbID        string            `json:"imdbId"`
		Year          string            `json:"year"`
		PosterURL     string            `json:"posterUrl"`
		Season        int               `json:"season"`
		Episode       int               `json:"episode"`
		EpisodeTitle  string            `json:"episodeTitle"`
		EpisodeTitles map[string]string `json:"episodeTitles"`
		Quality       string            `json:"quality"`
		Codec         string            `json:"codec"`
	}

	if r.Method == http.MethodPost && r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&payload)
	}
	if payload.Magnet == "" {
		payload.Magnet = r.URL.Query().Get("magnet")
	}
	if payload.Title == "" {
		payload.Title = r.URL.Query().Get("title")
	}
	if payload.ImdbID == "" {
		payload.ImdbID = r.URL.Query().Get("imdbId")
	}
	if payload.MediaType == "" {
		payload.MediaType = r.URL.Query().Get("mediaType")
		if payload.MediaType == "" {
			if payload.Season > 0 || payload.Episode > 0 {
				payload.MediaType = "tv"
			} else {
				payload.MediaType = "movie"
			}
		}
	}

	if payload.Magnet == "" {
		http.Error(w, `{"status":false,"error":"missing magnet"}`, http.StatusBadRequest)
		return
	}

	fileIdx := -1
	if payload.FileIdx != nil {
		fileIdx = *payload.FileIdx
	} else if idxStr := r.URL.Query().Get("fileIdx"); idxStr != "" {
		if parsed, err := strconv.Atoi(idxStr); err == nil {
			fileIdx = parsed
		}
	}

	dlID := payload.ID
	if dlID == "" {
		dlID = buildDownloadID(payload.ImdbID, payload.TmdbID, payload.Season, payload.Episode, payload.InfoHash, fileIdx)
	}

	downloadsLock.Lock()
	used := computeUsedBytesLocked()
	if used >= MaxDownloadQuotaBytes {
		downloadsLock.Unlock()
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": false,
			"error":  "Insufficient Trova storage (75 GB limit reached). Delete a download to free space.",
		})
		return
	}

	entry, exists := downloads[dlID]
	if !exists {
		entry = &DownloadEntry{
			ID:        dlID,
			CreatedAt: time.Now().Unix(),
		}
		downloads[dlID] = entry
	}

	entry.Magnet = payload.Magnet
	if payload.InfoHash != "" {
		entry.InfoHash = strings.ToLower(payload.InfoHash)
	}
	entry.FileIdx = fileIdx
	if payload.Title != "" {
		entry.Title = payload.Title
	}
	if payload.ReleaseName != "" {
		entry.ReleaseName = payload.ReleaseName
	}
	entry.MediaType = payload.MediaType
	if payload.TmdbID > 0 {
		entry.TmdbID = payload.TmdbID
	}
	if payload.ImdbID != "" {
		entry.ImdbID = payload.ImdbID
	}
	if payload.Year != "" {
		entry.Year = payload.Year
	}
	if payload.PosterURL != "" {
		entry.PosterURL = payload.PosterURL
	}
	if payload.Season > 0 {
		entry.Season = payload.Season
	}
	if payload.Episode > 0 {
		entry.Episode = payload.Episode
	}
	if payload.EpisodeTitle != "" {
		entry.EpisodeTitle = payload.EpisodeTitle
	}
	if len(payload.EpisodeTitles) > 0 {
		entry.EpisodeTitles = payload.EpisodeTitles
	}
	if payload.Quality != "" {
		entry.Quality = payload.Quality
	}
	if payload.Codec != "" {
		entry.Codec = payload.Codec
	}
	entry.State = "resolving"
	entry.ErrorMsg = ""
	entry.lastSampleTime = time.Now()
	saveDownloadsIndexLocked()
	downloadsLock.Unlock()

	activateDownloadEntry(entry)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   true,
		"download": entry,
	})
}

func downloadStatusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	downloadsLock.Lock()
	used := computeUsedBytesLocked()
	free := MaxDownloadQuotaBytes - used
	if free < 0 {
		free = 0
	}
	list := make([]*DownloadEntry, 0, len(downloads))
	activeCount := 0
	for _, d := range downloads {
		list = append(list, d)
		if d.State == "downloading" || d.State == "resolving" {
			activeCount++
		}
	}
	downloadsLock.Unlock()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      true,
		"maxBytes":    MaxDownloadQuotaBytes,
		"usedBytes":   used,
		"freeBytes":   free,
		"activeCount": activeCount,
		"downloads":   list,
	})
}

func downloadPauseHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	id := r.URL.Query().Get("id")
	infoHash := strings.TrimSpace(r.URL.Query().Get("infoHash"))
	if id == "" && infoHash == "" {
		http.Error(w, `{"status":false,"error":"missing id or infoHash"}`, http.StatusBadRequest)
		return
	}

	downloadsLock.Lock()
	var matched []*DownloadEntry
	if id != "" {
		if entry, ok := downloads[id]; ok {
			matched = append(matched, entry)
		}
	} else {
		for _, entry := range downloads {
			if strings.EqualFold(entry.InfoHash, infoHash) {
				matched = append(matched, entry)
			}
		}
	}

	if len(matched) == 0 {
		downloadsLock.Unlock()
		http.Error(w, `{"status":false,"error":"download not found"}`, http.StatusNotFound)
		return
	}

	var hash string
	var pausedFileIndices []int
	for _, entry := range matched {
		if entry.InfoHash != "" {
			hash = entry.InfoHash
		}
		if entry.State != "completed" {
			entry.State = "paused"
			entry.SpeedBps = 0
			entry.Peers = 0
			if entry.FileIdx >= 0 {
				pausedFileIndices = append(pausedFileIndices, entry.FileIdx)
			}
		}
	}
	saveDownloadsIndexLocked()
	downloadsLock.Unlock()

	if hash != "" {
		stillProtected := isProtectedInfoHash(hash)
		clientLock.Lock()
		client := tClient
		clientLock.Unlock()
		if client != nil {
			for _, t := range client.Torrents() {
				if strings.EqualFold(t.InfoHash().HexString(), hash) {
					if !stillProtected {
						t.Drop()
					} else if t.Info() != nil {
						files := t.Files()
						for _, idx := range pausedFileIndices {
							if idx >= 0 && idx < len(files) {
								files[idx].Cancel()
							}
						}
					}
				}
			}
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   true,
		"download": matched[0],
	})
}

func downloadResumeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	id := r.URL.Query().Get("id")
	infoHash := strings.TrimSpace(r.URL.Query().Get("infoHash"))
	if id == "" && infoHash == "" {
		http.Error(w, `{"status":false,"error":"missing id or infoHash"}`, http.StatusBadRequest)
		return
	}

	downloadsLock.Lock()
	var matched []*DownloadEntry
	if id != "" {
		if entry, ok := downloads[id]; ok {
			matched = append(matched, entry)
		}
	} else {
		for _, entry := range downloads {
			if strings.EqualFold(entry.InfoHash, infoHash) {
				matched = append(matched, entry)
			}
		}
	}

	if len(matched) == 0 {
		downloadsLock.Unlock()
		http.Error(w, `{"status":false,"error":"download not found"}`, http.StatusNotFound)
		return
	}

	var toActivate []*DownloadEntry
	for _, entry := range matched {
		if entry.State != "completed" {
			entry.State = "resolving"
			entry.ErrorMsg = ""
			entry.lastSampleTime = time.Now()
			toActivate = append(toActivate, entry)
		}
	}
	saveDownloadsIndexLocked()
	downloadsLock.Unlock()

	for _, entry := range toActivate {
		activateDownloadEntry(entry)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   true,
		"download": matched[0],
	})
}

func downloadDeleteHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	id := r.URL.Query().Get("id")
	infoHash := strings.TrimSpace(r.URL.Query().Get("infoHash"))
	if id == "" && infoHash == "" {
		http.Error(w, `{"status":false,"error":"missing id or infoHash"}`, http.StatusBadRequest)
		return
	}

	downloadsLock.Lock()
	var toDelete []*DownloadEntry
	if id != "" {
		if entry, ok := downloads[id]; ok {
			toDelete = append(toDelete, entry)
		}
	} else {
		for _, entry := range downloads {
			if strings.EqualFold(entry.InfoHash, infoHash) {
				toDelete = append(toDelete, entry)
			}
		}
	}

	if len(toDelete) == 0 {
		downloadsLock.Unlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"status": true})
		return
	}

	var hash string
	var rootDir string
	var filePaths []string
	var subPaths []string

	for _, entry := range toDelete {
		delete(downloads, entry.ID)
		if entry.InfoHash != "" {
			hash = entry.InfoHash
		}
		if entry.RootDir != "" {
			rootDir = entry.RootDir
		}
		if entry.FilePath != "" {
			filePaths = append(filePaths, entry.FilePath)
		}
		if entry.SubtitlePath != "" {
			subPaths = append(subPaths, entry.SubtitlePath)
		}
	}

	sharedHash := false
	for _, other := range downloads {
		if hash != "" && strings.EqualFold(other.InfoHash, hash) {
			sharedHash = true
			break
		}
	}
	saveDownloadsIndexLocked()
	used := computeUsedBytesLocked()
	downloadsLock.Unlock()

	if !sharedHash && hash != "" {
		clientLock.Lock()
		client := tClient
		clientLock.Unlock()
		if client != nil {
			for _, t := range client.Torrents() {
				if strings.EqualFold(t.InfoHash().HexString(), hash) {
					t.Drop()
				}
			}
		}
	}

	for _, fp := range filePaths {
		_ = os.Remove(fp)
	}
	if !sharedHash && rootDir != "" && cachePath != "" {
		targetRoot := filepath.Join(cachePath, rootDir)
		if targetRoot != cachePath {
			_ = os.RemoveAll(targetRoot)
		}
	}
	for _, sp := range subPaths {
		_ = os.Remove(sp)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    true,
		"usedBytes": used,
		"maxBytes":  MaxDownloadQuotaBytes,
	})
}

func downloadPlayHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "missing id query parameter", http.StatusBadRequest)
		return
	}

	downloadsLock.Lock()
	entry, ok := downloads[id]
	downloadsLock.Unlock()
	if !ok {
		http.Error(w, "download not found", http.StatusNotFound)
		return
	}

	// Fast path: if file exists on disk and download is completed (or paused with existing file), serve directly from local filesystem!
	if entry.FilePath != "" && (entry.State == "completed" || entry.State == "paused") {
		if fi, err := os.Stat(entry.FilePath); err == nil && fi.Size() > 0 {
			f, openErr := os.Open(entry.FilePath)
			if openErr == nil {
				defer f.Close()
				logInfo("downloadPlayHandler: serving local file directly from disk '%s' (%d bytes)", entry.FilePath, fi.Size())
				writeVideoHeaders(w, entry.Filename)
				http.ServeContent(w, r, entry.Filename, fi.ModTime(), f)
				return
			}
		}
	}

	// Fallback: stream via active torrent engine while downloading
	q := r.URL.Query()
	q.Set("magnet", entry.Magnet)
	if entry.FileIdx >= 0 {
		q.Set("fileIdx", strconv.Itoa(entry.FileIdx))
	}
	r.URL.RawQuery = q.Encode()
	streamHandler(w, r)
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
	loadDownloadsIndex()

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
		go runDownloadMonitor()
		go func() {
			downloadsLock.Lock()
			var toActivate []*DownloadEntry
			for _, d := range downloads {
				if d.State == "resolving" {
					toActivate = append(toActivate, d)
				}
			}
			downloadsLock.Unlock()
			for _, d := range toActivate {
				activateDownloadEntry(d)
			}
		}()

		mux := http.NewServeMux()
		mux.HandleFunc("/stream", streamHandler)
		mux.HandleFunc("/preload", preloadHandler)
		mux.HandleFunc("/download/start", downloadStartHandler)
		mux.HandleFunc("/download/status", downloadStatusHandler)
		mux.HandleFunc("/download/pause", downloadPauseHandler)
		mux.HandleFunc("/download/resume", downloadResumeHandler)
		mux.HandleFunc("/download/delete", downloadDeleteHandler)
		mux.HandleFunc("/download/play", downloadPlayHandler)
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
