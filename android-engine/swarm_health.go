package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	udpProtocolID      uint64 = 0x41727101980
	maxUDPScrapeBatch         = 70
	nyaaScrapeURL             = "http://nyaa.tracker.wf:7777/scrape"
	maxReasonableCount        = 10000000
)

var defaultLiveUDPTrackers = []string{
	"udp://tracker.opentrackr.org:1337/announce",
	"udp://open.stealth.si:80/announce",
	"udp://open.demonii.com:1337/announce",
	"udp://tracker.dler.org:6969/announce",
	"udp://tracker.bittor.pw:1337/announce",
	"udp://explodie.org:6969/announce",
	"udp://open.tracker.cl:1337/announce",
	"udp://tracker.internetwarriors.net:1337/announce",
}

type ScrapeStats struct {
	Seeders           int `json:"seeders"`
	Leechers          int `json:"leechers"`
	TrackersResponded int `json:"trackersResponded"`
}

type ProbeResult struct {
	Checked          bool `json:"checked"`
	PeersFound       int  `json:"peersFound"`
	HandshakesOk     int  `json:"handshakesOk"`
	PeersWithPieces  int  `json:"peersWithPieces"`
	FullSeeds        int  `json:"fullSeeds"`
	SupportsMetadata bool `json:"supportsMetadata"`
	LatencyMs        int  `json:"latencyMs"`
}

type peerAddr struct {
	IP   string
	Port uint16
}

type tcpPeerInfo struct {
	SupportsMetadata bool
	HasPieces        bool
	IsSeed           bool
}

func isValidHexHash(h string) bool {
	if len(h) != 40 {
		return false
	}
	_, err := hex.DecodeString(h)
	return err == nil
}

func clampSwarmCount(v uint32) int {
	if v > maxReasonableCount {
		return 0
	}
	return int(v)
}

func dedupValidHashes(hashes []string) []string {
	seen := make(map[string]struct{}, len(hashes))
	out := make([]string, 0, len(hashes))
	for _, raw := range hashes {
		h := strings.ToLower(strings.TrimSpace(raw))
		if !isValidHexHash(h) {
			continue
		}
		if _, ok := seen[h]; ok {
			continue
		}
		seen[h] = struct{}{}
		out = append(out, h)
	}
	return out
}

func parseUDPTrackerAddr(trackerURL string) (string, error) {
	u, err := url.Parse(trackerURL)
	if err != nil {
		return "", err
	}
	host := u.Hostname()
	if host == "" {
		return "", fmt.Errorf("missing host")
	}
	port := u.Port()
	if port == "" {
		port = "80"
	}
	return net.JoinHostPort(host, port), nil
}

func scrapeUDPTracker(trackerURL string, infoHashes []string, timeout time.Duration) (bool, map[string][2]int) {
	validHashes := dedupValidHashes(infoHashes)
	if len(validHashes) == 0 {
		return false, nil
	}

	hostPort, err := parseUDPTrackerAddr(trackerURL)
	if err != nil {
		return false, nil
	}

	udpAddr, err := net.ResolveUDPAddr("udp4", hostPort)
	if err != nil {
		return false, nil
	}

	conn, err := net.DialUDP("udp4", nil, udpAddr)
	if err != nil {
		return false, nil
	}
	defer conn.Close()

	if err := conn.SetDeadline(time.Now().Add(timeout)); err != nil {
		return false, nil
	}

	// BEP-15 Connect
	txConnect := rand.Uint32()
	if txConnect == 0 {
		txConnect = 1
	}
	var connectReq [16]byte
	binary.BigEndian.PutUint64(connectReq[0:8], udpProtocolID)
	binary.BigEndian.PutUint32(connectReq[8:12], 0)
	binary.BigEndian.PutUint32(connectReq[12:16], txConnect)
	if _, err := conn.Write(connectReq[:]); err != nil {
		return false, nil
	}

	var connectResp [64]byte
	n, err := conn.Read(connectResp[:])
	if err != nil || n < 16 {
		return false, nil
	}
	act := binary.BigEndian.Uint32(connectResp[0:4])
	rxTx := binary.BigEndian.Uint32(connectResp[4:8])
	connID := binary.BigEndian.Uint64(connectResp[8:16])
	if act != 0 || rxTx != txConnect {
		return false, nil
	}

	out := make(map[string][2]int, len(validHashes))
	responded := false
	respBuf := make([]byte, 4096)

	for start := 0; start < len(validHashes); start += maxUDPScrapeBatch {
		end := start + maxUDPScrapeBatch
		if end > len(validHashes) {
			end = len(validHashes)
		}
		chunk := validHashes[start:end]

		txScrape := rand.Uint32()
		if txScrape == 0 {
			txScrape = 1
		}
		req := make([]byte, 16+len(chunk)*20)
		binary.BigEndian.PutUint64(req[0:8], connID)
		binary.BigEndian.PutUint32(req[8:12], 2) // scrape
		binary.BigEndian.PutUint32(req[12:16], txScrape)
		for i, h := range chunk {
			b, _ := hex.DecodeString(h)
			copy(req[16+i*20:16+(i+1)*20], b)
		}

		_ = conn.SetDeadline(time.Now().Add(timeout))
		if _, err := conn.Write(req); err != nil {
			continue
		}
		sn, err := conn.Read(respBuf)
		if err != nil || sn < 8 {
			continue
		}
		sAct := binary.BigEndian.Uint32(respBuf[0:4])
		sTx := binary.BigEndian.Uint32(respBuf[4:8])
		if sAct != 2 || sTx != txScrape {
			continue
		}
		responded = true
		body := respBuf[8:sn]
		for i, h := range chunk {
			off := i * 12
			if off+12 <= len(body) {
				seeders := binary.BigEndian.Uint32(body[off : off+4])
				leechers := binary.BigEndian.Uint32(body[off+8 : off+12])
				out[h] = [2]int{clampSwarmCount(seeders), clampSwarmCount(leechers)}
			}
		}
	}

	return responded, out
}

func bdecodeNext(data []byte, idx int) (any, int, error) {
	if idx >= len(data) {
		return nil, idx, fmt.Errorf("unexpected EOF")
	}
	switch data[idx] {
	case 'i':
		end := bytes.IndexByte(data[idx+1:], 'e')
		if end < 0 {
			return nil, idx, fmt.Errorf("unterminated int")
		}
		val, err := strconv.ParseInt(string(data[idx+1:idx+1+end]), 10, 64)
		if err != nil {
			return nil, idx, err
		}
		return val, idx + 1 + end + 1, nil
	case 'l':
		idx++
		var items []any
		for idx < len(data) && data[idx] != 'e' {
			v, next, err := bdecodeNext(data, idx)
			if err != nil {
				return nil, idx, err
			}
			items = append(items, v)
			idx = next
		}
		if idx >= len(data) {
			return nil, idx, fmt.Errorf("unterminated list")
		}
		return items, idx + 1, nil
	case 'd':
		idx++
		m := make(map[string]any)
		for idx < len(data) && data[idx] != 'e' {
			kRaw, next, err := bdecodeNext(data, idx)
			if err != nil {
				return nil, idx, err
			}
			kBytes, ok := kRaw.([]byte)
			if !ok {
				return nil, idx, fmt.Errorf("non-string dict key")
			}
			v, next2, err := bdecodeNext(data, next)
			if err != nil {
				return nil, next, err
			}
			m[string(kBytes)] = v
			idx = next2
		}
		if idx >= len(data) {
			return nil, idx, fmt.Errorf("unterminated dict")
		}
		return m, idx + 1, nil
	default:
		colon := bytes.IndexByte(data[idx:], ':')
		if colon < 0 {
			return nil, idx, fmt.Errorf("missing colon")
		}
		length, err := strconv.Atoi(string(data[idx : idx+colon]))
		if err != nil || length < 0 {
			return nil, idx, fmt.Errorf("invalid string length")
		}
		start := idx + colon + 1
		end := start + length
		if end > len(data) {
			return nil, idx, fmt.Errorf("string out of bounds")
		}
		return data[start:end], end, nil
	}
}

func encodeInfoHashQuery(hashHex string) string {
	b, _ := hex.DecodeString(hashHex)
	var sb strings.Builder
	for _, c := range b {
		fmt.Fprintf(&sb, "%%%02X", c)
	}
	return sb.String()
}

func scrapeHTTPTracker(scrapeURL string, infoHashes []string, timeout time.Duration) (bool, map[string][2]int) {
	validHashes := dedupValidHashes(infoHashes)
	if len(validHashes) == 0 {
		return false, nil
	}

	client := &http.Client{Timeout: timeout}
	out := make(map[string][2]int, len(validHashes))
	responded := false

	for start := 0; start < len(validHashes); start += 40 {
		end := start + 40
		if end > len(validHashes) {
			end = len(validHashes)
		}
		chunk := validHashes[start:end]
		parts := make([]string, 0, len(chunk))
		for _, h := range chunk {
			parts = append(parts, "info_hash="+encodeInfoHashQuery(h))
		}
		req, err := http.NewRequest("GET", scrapeURL+"?"+strings.Join(parts, "&"), nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "trova/1.2")
		resp, err := client.Do(req)
		if err != nil {
			continue
		}
		raw, readErr := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
		resp.Body.Close()
		if readErr != nil || resp.StatusCode != http.StatusOK {
			continue
		}

		decoded, _, err := bdecodeNext(raw, 0)
		if err != nil {
			continue
		}
		rootMap, ok := decoded.(map[string]any)
		if !ok {
			continue
		}
		filesMap, ok := rootMap["files"].(map[string]any)
		if !ok {
			continue
		}
		responded = true
		for rawHash, statsAny := range filesMap {
			if len(rawHash) != 20 {
				continue
			}
			statsMap, ok := statsAny.(map[string]any)
			if !ok {
				continue
			}
			sVal, _ := statsMap["complete"].(int64)
			lVal, _ := statsMap["incomplete"].(int64)
			if sVal < 0 {
				sVal = 0
			}
			if lVal < 0 {
				lVal = 0
			}
			out[strings.ToLower(hex.EncodeToString([]byte(rawHash)))] = [2]int{
				clampSwarmCount(uint32(sVal)),
				clampSwarmCount(uint32(lVal)),
			}
		}
	}

	return responded, out
}

func scrapeSwarms(infoHashes, trackers, nyaaHashes []string, timeout time.Duration) (int, map[string]ScrapeStats) {
	uniqueHashes := dedupValidHashes(infoHashes)
	if len(uniqueHashes) == 0 {
		return 0, map[string]ScrapeStats{}
	}
	if len(trackers) == 0 {
		trackers = defaultLiveUDPTrackers
	}
	uniqueNyaa := dedupValidHashes(nyaaHashes)

	best := make(map[string][2]int, len(uniqueHashes))
	for _, h := range uniqueHashes {
		best[h] = [2]int{0, 0}
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	respondedCount := 0

	for _, tr := range trackers {
		wg.Add(1)
		go func(tracker string) {
			defer wg.Done()
			ok, mapping := scrapeUDPTracker(tracker, uniqueHashes, timeout)
			if !ok {
				return
			}
			mu.Lock()
			respondedCount++
			for h, pair := range mapping {
				prev := best[h]
				if pair[0] > prev[0] {
					prev[0] = pair[0]
				}
				if pair[1] > prev[1] {
					prev[1] = pair[1]
				}
				best[h] = prev
			}
			mu.Unlock()
		}(tr)
	}

	if len(uniqueNyaa) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, mapping := scrapeHTTPTracker(nyaaScrapeURL, uniqueNyaa, timeout+500*time.Millisecond)
			if !ok {
				return
			}
			mu.Lock()
			respondedCount++
			for h, pair := range mapping {
				prev := best[h]
				if pair[0] > prev[0] {
					prev[0] = pair[0]
				}
				if pair[1] > prev[1] {
					prev[1] = pair[1]
				}
				best[h] = prev
			}
			mu.Unlock()
		}()
	}

	wg.Wait()
	if respondedCount == 0 {
		return 0, map[string]ScrapeStats{}
	}

	stats := make(map[string]ScrapeStats, len(best))
	for h, pair := range best {
		stats[h] = ScrapeStats{
			Seeders:           pair[0],
			Leechers:          pair[1],
			TrackersResponded: respondedCount,
		}
	}
	return respondedCount, stats
}

func udpAnnouncePeers(trackerURL, infoHash string, numWant int32, timeout time.Duration) (int, int, []peerAddr) {
	if !isValidHexHash(infoHash) {
		return 0, 0, nil
	}
	hostPort, err := parseUDPTrackerAddr(trackerURL)
	if err != nil {
		return 0, 0, nil
	}
	udpAddr, err := net.ResolveUDPAddr("udp4", hostPort)
	if err != nil {
		return 0, 0, nil
	}
	conn, err := net.DialUDP("udp4", nil, udpAddr)
	if err != nil {
		return 0, 0, nil
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout))

	txConnect := rand.Uint32()
	if txConnect == 0 {
		txConnect = 1
	}
	var connectReq [16]byte
	binary.BigEndian.PutUint64(connectReq[0:8], udpProtocolID)
	binary.BigEndian.PutUint32(connectReq[8:12], 0)
	binary.BigEndian.PutUint32(connectReq[12:16], txConnect)
	if _, err := conn.Write(connectReq[:]); err != nil {
		return 0, 0, nil
	}

	var connectResp [64]byte
	n, err := conn.Read(connectResp[:])
	if err != nil || n < 16 {
		return 0, 0, nil
	}
	if binary.BigEndian.Uint32(connectResp[0:4]) != 0 || binary.BigEndian.Uint32(connectResp[4:8]) != txConnect {
		return 0, 0, nil
	}
	connID := binary.BigEndian.Uint64(connectResp[8:16])

	txAnn := rand.Uint32()
	if txAnn == 0 {
		txAnn = 1
	}
	ihBytes, _ := hex.DecodeString(strings.ToLower(infoHash))
	var peerID [20]byte
	copy(peerID[:8], "-TR0120-")
	for i := 8; i < 20; i++ {
		peerID[i] = byte(rand.Intn(256))
	}

	var req [98]byte
	binary.BigEndian.PutUint64(req[0:8], connID)
	binary.BigEndian.PutUint32(req[8:12], 1) // announce
	binary.BigEndian.PutUint32(req[12:16], txAnn)
	copy(req[16:36], ihBytes)
	copy(req[36:56], peerID[:])
	binary.BigEndian.PutUint64(req[56:64], 0) // downloaded
	binary.BigEndian.PutUint64(req[64:72], 1) // left (> 0 so tracker never counts us as a seeder)
	binary.BigEndian.PutUint64(req[72:80], 0) // uploaded
	binary.BigEndian.PutUint32(req[80:84], 0) // event = none
	binary.BigEndian.PutUint32(req[84:88], 0) // ip = default
	binary.BigEndian.PutUint32(req[88:92], rand.Uint32())
	binary.BigEndian.PutUint32(req[92:96], uint32(numWant))
	binary.BigEndian.PutUint16(req[96:98], uint16(49152+rand.Intn(15000)))

	_ = conn.SetDeadline(time.Now().Add(timeout))
	if _, err := conn.Write(req[:]); err != nil {
		return 0, 0, nil
	}

	respBuf := make([]byte, 4096)
	rn, err := conn.Read(respBuf)
	if err != nil || rn < 20 {
		return 0, 0, nil
	}
	if binary.BigEndian.Uint32(respBuf[0:4]) != 1 || binary.BigEndian.Uint32(respBuf[4:8]) != txAnn {
		return 0, 0, nil
	}
	leechers := clampSwarmCount(binary.BigEndian.Uint32(respBuf[12:16]))
	seeders := clampSwarmCount(binary.BigEndian.Uint32(respBuf[16:20]))

	body := respBuf[20:rn]
	peers := make([]peerAddr, 0, len(body)/6)
	for off := 0; off+6 <= len(body); off += 6 {
		ip := net.IPv4(body[off], body[off+1], body[off+2], body[off+3]).String()
		port := binary.BigEndian.Uint16(body[off+4 : off+6])
		if port > 0 && ip != "0.0.0.0" {
			peers = append(peers, peerAddr{IP: ip, Port: port})
		}
	}
	return seeders, leechers, peers
}

func bitfieldHasPiecesAndIsFull(bf []byte) (bool, bool) {
	if len(bf) == 0 {
		return false, false
	}
	hasPieces := false
	for _, b := range bf {
		if b != 0 {
			hasPieces = true
			break
		}
	}
	if !hasPieces {
		return false, false
	}
	for i := 0; i < len(bf)-1; i++ {
		if bf[i] != 0xFF {
			return true, false
		}
	}
	last := bf[len(bf)-1]
	switch last {
	case 0x80, 0xC0, 0xE0, 0xF0, 0xF8, 0xFC, 0xFE, 0xFF:
		return true, true
	default:
		return true, false
	}
}

func probePeerTCP(ctx context.Context, ip string, port uint16, infoHashBytes []byte, timeout time.Duration) *tcpPeerInfo {
	dialer := &net.Dialer{Timeout: timeout}
	conn, err := dialer.DialContext(ctx, "tcp4", net.JoinHostPort(ip, strconv.Itoa(int(port))))
	if err != nil {
		return nil
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(timeout))

	var handshake [68]byte
	handshake[0] = 19
	copy(handshake[1:20], "BitTorrent protocol")
	handshake[25] = 0x10 // BEP-10 extension protocol
	handshake[27] = 0x04 // BEP-6 fast extension
	copy(handshake[28:48], infoHashBytes)
	copy(handshake[48:56], "-TR0120-")
	for i := 56; i < 68; i++ {
		handshake[i] = byte(rand.Intn(256))
	}

	if _, err := conn.Write(handshake[:]); err != nil {
		return nil
	}

	var resp [68]byte
	if _, err := io.ReadFull(conn, resp[:]); err != nil {
		return nil
	}
	if resp[0] != 19 || string(resp[1:20]) != "BitTorrent protocol" || !bytes.Equal(resp[28:48], infoHashBytes) {
		return nil
	}

	info := &tcpPeerInfo{
		SupportsMetadata: (resp[25] & 0x10) != 0,
	}

	var hdr [4]byte
	for i := 0; i < 4; i++ {
		_ = conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		if _, err := io.ReadFull(conn, hdr[:]); err != nil {
			break
		}
		mlen := binary.BigEndian.Uint32(hdr[:])
		if mlen == 0 {
			continue
		}
		if mlen > 65536 {
			break
		}
		msg := make([]byte, mlen)
		if _, err := io.ReadFull(conn, msg); err != nil {
			break
		}
		mid := msg[0]
		switch mid {
		case 14: // BEP-6 Have All
			info.HasPieces = true
			info.IsSeed = true
		case 5: // Bitfield
			hp, full := bitfieldHasPiecesAndIsFull(msg[1:])
			if hp {
				info.HasPieces = true
			}
			if full {
				info.IsSeed = true
			}
		case 4: // Have
			info.HasPieces = true
		case 20: // BEP-10 Extended Handshake
			if len(msg) > 2 && msg[1] == 0 && bytes.Contains(msg[2:], []byte("ut_metadata")) {
				info.SupportsMetadata = true
			}
		}
		if info.IsSeed {
			break
		}
	}

	return info
}

func probeTorrentReachability(infoHash string, trackers []string, maxPeers int, timeout time.Duration, peersOverride []peerAddr) ProbeResult {
	if !isValidHexHash(infoHash) {
		return ProbeResult{Checked: false}
	}
	if maxPeers <= 0 {
		maxPeers = 24
	}
	t0 := time.Now()

	var peers []peerAddr
	if peersOverride != nil {
		seen := make(map[peerAddr]struct{}, len(peersOverride))
		for _, p := range peersOverride {
			if _, ok := seen[p]; !ok {
				seen[p] = struct{}{}
				peers = append(peers, p)
				if len(peers) >= maxPeers {
					break
				}
			}
		}
	} else {
		trList := trackers
		if len(trList) == 0 {
			trList = defaultLiveUDPTrackers
		}
		if len(trList) > 4 {
			trList = trList[:4]
		}
		perTracker := make([][]peerAddr, len(trList))
		var wg sync.WaitGroup
		for i, tr := range trList {
			wg.Add(1)
			go func(idx int, tracker string) {
				defer wg.Done()
				_, _, list := udpAnnouncePeers(tracker, infoHash, 30, 1300*time.Millisecond)
				perTracker[idx] = list
			}(i, tr)
		}
		wg.Wait()

		maxLen := 0
		for _, lst := range perTracker {
			if len(lst) > maxLen {
				maxLen = len(lst)
			}
		}
		seen := make(map[peerAddr]struct{}, maxPeers)
		for i := 0; i < maxLen && len(peers) < maxPeers; i++ {
			for _, lst := range perTracker {
				if i < len(lst) {
					p := lst[i]
					if _, ok := seen[p]; !ok {
						seen[p] = struct{}{}
						peers = append(peers, p)
						if len(peers) >= maxPeers {
							break
						}
					}
				}
			}
		}
	}

	if len(peers) == 0 {
		return ProbeResult{
			Checked:    true,
			PeersFound: 0,
			LatencyMs:  int(time.Since(t0).Milliseconds()),
		}
	}

	ihBytes, _ := hex.DecodeString(strings.ToLower(infoHash))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	resultsCh := make(chan *tcpPeerInfo, len(peers))
	for _, p := range peers {
		go func(peer peerAddr) {
			resultsCh <- probePeerTCP(ctx, peer.IP, peer.Port, ihBytes, timeout)
		}(p)
	}

	res := ProbeResult{
		Checked:    true,
		PeersFound: len(peers),
	}

	for i := 0; i < len(peers); i++ {
		info := <-resultsCh
		if info == nil {
			continue
		}
		res.HandshakesOk++
		if info.HasPieces {
			res.PeersWithPieces++
		}
		if info.IsSeed {
			res.FullSeeds++
		}
		if info.SupportsMetadata {
			res.SupportsMetadata = true
		}
		if res.FullSeeds >= 1 || res.PeersWithPieces >= 2 || res.HandshakesOk >= 3 {
			cancel()
			break
		}
	}

	res.LatencyMs = int(time.Since(t0).Milliseconds())
	return res
}

func probeSwarms(infoHashes, trackers []string, maxPeers int, timeout time.Duration) map[string]ProbeResult {
	uniqueHashes := dedupValidHashes(infoHashes)
	out := make(map[string]ProbeResult, len(uniqueHashes))
	if len(uniqueHashes) == 0 {
		return out
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, h := range uniqueHashes {
		wg.Add(1)
		go func(hash string) {
			defer wg.Done()
			res := probeTorrentReachability(hash, trackers, maxPeers, timeout, nil)
			mu.Lock()
			out[hash] = res
			mu.Unlock()
		}(h)
	}
	wg.Wait()
	return out
}

func swarmScrapeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"ok":false,"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	var payload struct {
		InfoHashes []string `json:"infoHashes"`
		NyaaHashes []string `json:"nyaaHashes"`
		Trackers   []string `json:"trackers"`
		TimeoutMs  int      `json:"timeoutMs"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 512*1024)).Decode(&payload); err != nil {
		http.Error(w, `{"ok":false,"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	timeout := 1500 * time.Millisecond
	if payload.TimeoutMs >= 300 && payload.TimeoutMs <= 5000 {
		timeout = time.Duration(payload.TimeoutMs) * time.Millisecond
	}

	responded, stats := scrapeSwarms(payload.InfoHashes, payload.Trackers, payload.NyaaHashes, timeout)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":                responded > 0,
		"trackersResponded": responded,
		"stats":             stats,
	})
}

func swarmProbeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"ok":false,"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	var payload struct {
		InfoHashes []string `json:"infoHashes"`
		Trackers   []string `json:"trackers"`
		MaxPeers   int      `json:"maxPeers"`
		TimeoutMs  int      `json:"timeoutMs"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 512*1024)).Decode(&payload); err != nil {
		http.Error(w, `{"ok":false,"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	timeout := 1800 * time.Millisecond
	if payload.TimeoutMs >= 400 && payload.TimeoutMs <= 6000 {
		timeout = time.Duration(payload.TimeoutMs) * time.Millisecond
	}
	maxPeers := payload.MaxPeers
	if maxPeers <= 0 || maxPeers > 40 {
		maxPeers = 24
	}

	probes := probeSwarms(payload.InfoHashes, payload.Trackers, maxPeers, timeout)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":     true,
		"probes": probes,
	})
}
