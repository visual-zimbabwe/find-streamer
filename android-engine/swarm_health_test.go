package main

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestBitfieldHasPiecesAndIsFull(t *testing.T) {
	has, full := bitfieldHasPiecesAndIsFull([]byte{0xFF, 0xF0})
	if !has || !full {
		t.Fatalf("expected has=true full=true, got has=%v full=%v", has, full)
	}
	has, full = bitfieldHasPiecesAndIsFull([]byte{0xFF, 0x0F})
	if !has || full {
		t.Fatalf("expected has=true full=false, got has=%v full=%v", has, full)
	}
	has, full = bitfieldHasPiecesAndIsFull([]byte{0x00, 0x00})
	if has || full {
		t.Fatalf("expected has=false full=false, got has=%v full=%v", has, full)
	}
}

func TestScrapeUDPTrackerMock(t *testing.T) {
	pc, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen udp: %v", err)
	}
	defer pc.Close()

	hashHex := "0123456789abcdef0123456789abcdef01234567"

	go func() {
		buf := make([]byte, 2048)
		for {
			n, addr, err := pc.ReadFrom(buf)
			if err != nil {
				return
			}
			if n < 16 {
				continue
			}
			act := binary.BigEndian.Uint32(buf[8:12])
			tx := binary.BigEndian.Uint32(buf[12:16])
			if act == 0 {
				var resp [16]byte
				binary.BigEndian.PutUint32(resp[0:4], 0)
				binary.BigEndian.PutUint32(resp[4:8], tx)
				binary.BigEndian.PutUint64(resp[8:16], 0x1122334455667788)
				_, _ = pc.WriteTo(resp[:], addr)
			} else if act == 2 {
				var resp [20]byte
				binary.BigEndian.PutUint32(resp[0:4], 2)
				binary.BigEndian.PutUint32(resp[4:8], tx)
				binary.BigEndian.PutUint32(resp[8:12], 55)  // seeders
				binary.BigEndian.PutUint32(resp[12:16], 100) // completed
				binary.BigEndian.PutUint32(resp[16:20], 12) // leechers
				_, _ = pc.WriteTo(resp[:], addr)
			}
		}
	}()

	trackerURL := fmt.Sprintf("udp://%s/announce", pc.LocalAddr().String())
	ok, stats := scrapeUDPTracker(trackerURL, []string{hashHex}, time.Second)
	if !ok {
		t.Fatalf("expected scrape ok=true")
	}
	pair := stats[hashHex]
	if pair[0] != 55 || pair[1] != 12 {
		t.Fatalf("expected (55, 12), got (%d, %d)", pair[0], pair[1])
	}
}

func TestProbeTorrentReachabilityMockPeer(t *testing.T) {
	ln, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen tcp: %v", err)
	}
	defer ln.Close()

	hashHex := "abcdef0123456789abcdef0123456789abcdef01"
	ihBytes, _ := hex.DecodeString(hashHex)

	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		var req [68]byte
		if _, err := io.ReadFull(conn, req[:]); err != nil {
			return
		}
		var resp [68]byte
		resp[0] = 19
		copy(resp[1:20], "BitTorrent protocol")
		resp[25] = 0x10
		copy(resp[28:48], ihBytes)
		copy(resp[48:68], "-MOCK01-000000000000")
		_, _ = conn.Write(resp[:])

		// Send BEP-6 Have All (len=1, id=14)
		_, _ = conn.Write([]byte{0, 0, 0, 1, 14})
	}()

	tcpAddr := ln.Addr().(*net.TCPAddr)
	res := probeTorrentReachability(
		hashHex,
		nil,
		4,
		time.Second,
		[]peerAddr{{IP: tcpAddr.IP.String(), Port: uint16(tcpAddr.Port)}},
	)
	if !res.Checked || res.HandshakesOk != 1 || res.FullSeeds != 1 || !res.SupportsMetadata {
		t.Fatalf("unexpected probe result: %+v", res)
	}
}

func TestSwarmScrapeHandlerValidation(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/swarm/scrape", bytes.NewBufferString(`{"infoHashes":[]}`))
	rec := httptest.NewRecorder()
	swarmScrapeHandler(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if out["ok"] != false {
		t.Fatalf("expected ok=false for empty hashes, got %v", out["ok"])
	}
}
