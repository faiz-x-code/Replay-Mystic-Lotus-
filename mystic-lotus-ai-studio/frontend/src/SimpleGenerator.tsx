import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Copy, Check, Play, Upload, RefreshCw, FileText, Code, Eye, Plus, Trash2, ArrowRight, Video, Target, Radio, Mail, GripVertical, ArrowUpDown, Pause, Rewind, FastForward, ExternalLink } from 'lucide-react';
import { api, YouTubeTranscriptInfo } from './api.js';
import { generateReplayEmailHtml, ReplayEmailData, EmailQuote, EmailMoment } from './emailTemplate.js';

interface TimestampItem {
  title: string;
  seconds: number;
  formattedTime: string;
}

function parseTimeStringToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(/[^\d:]/g, '');
  if (!clean) return 0;
  const parts = clean.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

function formatSecondsToTimeString(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function parseYouTubeId(url: string): string {
  if (!url) return '';
  const clean = url.trim();
  if (/^[\w-]{11}$/.test(clean)) return clean;
  const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|live\/|shorts\/|watch\?.*v=))([\w-]{11})/i);
  if (match) return match[1];
  const vMatch = clean.match(/[?&]v=([\w-]{11})/);
  if (vMatch) return vMatch[1];
  const liveMatch = clean.match(/\/live\/([\w-]{11})/);
  if (liveMatch) return liveMatch[1];
  return '';
}

export default function SimpleGenerator() {
  // Input fields requested by user
  const [masterclassName, setMasterclassName] = useState('Simmin Bawa Masterclass - Day 2');
  const [youtubeUrl, setYoutubeUrl] = useState('https://www.youtube.com/watch?v=OLXSmAhpU-g');
  const [playerNumber, setPlayerNumber] = useState<string>('1');
  const [startOffset, setStartOffset] = useState<string>('');
  const [detectedOffset, setDetectedOffset] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState('');

  // Native YouTube Transcript states
  const [ytTranscriptInfo, setYtTranscriptInfo] = useState<YouTubeTranscriptInfo | null>(null);
  const [fetchingYtTranscript, setFetchingYtTranscript] = useState(false);
  const [ytTranscriptNotice, setYtTranscriptNotice] = useState<string | null>(null);
  const [useYouTubeTranscript, setUseYouTubeTranscript] = useState(true);
  const [lastGenerationSource, setLastGenerationSource] = useState<'youtube' | 'upload' | null>(null);
  const [lastCueCount, setLastCueCount] = useState<number | null>(null);
  const [currentVideoPlayTime, setCurrentVideoPlayTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Additional customizable text (defaults populated automatically)
  const [heading, setHeading] = useState('Highlights from the Call');
  const [subheading, setSubheading] = useState('Explore powerful channeling experiences, energy alignments, group healings, and transformational breakthroughs from the call with Simmin Bawa.');

  // UI state
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'editor' | 'email'>('preview');
  const [activeTimestampSec, setActiveTimestampSec] = useState<number | null>(null);

  // Email Marketing states
  const [emailData, setEmailData] = useState<ReplayEmailData | null>(null);
  const [emailHtml, setEmailHtml] = useState<string>('');
  const [emailCopied, setEmailCopied] = useState(false);
  const [emailSubjCopied, setEmailSubjCopied] = useState(false);
  const [emailViewMode, setEmailViewMode] = useState<'visual' | 'code'>('visual');

  // Drag and drop states
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Generated deliverables
  const [videoId, setVideoId] = useState('OLXSmAhpU-g');
  const [tag, setTag] = useState('Simmin Bawa Masterclass Replay');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [timestamps, setTimestamps] = useState<TimestampItem[]>([]);
  const [wordpressHtml, setWordpressHtml] = useState<string>('');

  // YouTube player iframe & API player refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const isPlayerReadyRef = useRef<boolean>(false);
  const playerTimeRef = useRef<number>(0);
  const [syncedRowIdx, setSyncedRowIdx] = useState<number | null>(null);

  useEffect(() => {
    loadInitial();

    // Listen to YouTube player time updates for precision editor syncing
    function handleMessage(e: MessageEvent) {
      try {
        let data = e.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data) return;

        // Extract currentTime from infoDelivery or direct payload
        let sec: number | null = null;
        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') {
            sec = Math.floor(data.info.currentTime);
          }
          if (data.info.playerState === 1) setIsPlaying(true);
          else if (data.info.playerState === 2 || data.info.playerState === 0) setIsPlaying(false);
        } else if (data.info && typeof data.info.currentTime === 'number') {
          sec = Math.floor(data.info.currentTime);
        }

        if (sec !== null && !isNaN(sec) && sec >= 0) {
          playerTimeRef.current = sec;
          setCurrentVideoPlayTime(sec);
        }
      } catch {}
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Connect YouTube Player API and continuously synchronize live playhead
  useEffect(() => {
    let isCancelled = false;

    function setupYTPlayer() {
      if (isCancelled || typeof window === 'undefined') return;
      const iframe = document.getElementById('ml-shared-yt-player') as HTMLIFrameElement;
      if (!iframe) return;

      if ((window as any).YT && (window as any).YT.Player) {
        try {
          if (ytPlayerRef.current && isPlayerReadyRef.current) {
            return;
          }

          ytPlayerRef.current = new (window as any).YT.Player('ml-shared-yt-player', {
            events: {
              onReady: (e: any) => {
                isPlayerReadyRef.current = true;
                try {
                  e.target.getIframe()?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*');
                } catch {}
              },
              onStateChange: (event: any) => {
                // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
                if (event.data === 1) setIsPlaying(true);
                else if (event.data === 2 || event.data === 0) setIsPlaying(false);
              }
            }
          });
        } catch (err) {
          console.warn('YT Player init:', err);
        }
      }
    }

    if (typeof window !== 'undefined' && (window as any).YT && (window as any).YT.Player) {
      setupYTPlayer();
    } else if (typeof window !== 'undefined') {
      const prevCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        setupYTPlayer();
      };
    }

    const initTimer1 = setTimeout(setupYTPlayer, 600);
    const initTimer2 = setTimeout(setupYTPlayer, 1600);

    // Continuous 250ms polling of exact player time and sending listening handshake
    const timer = setInterval(() => {
      // 1. Direct API if ready
      if (isPlayerReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const t = ytPlayerRef.current.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t) && t >= 0) {
            const sec = Math.floor(t);
            playerTimeRef.current = sec;
            setCurrentVideoPlayTime(sec);
          }
        } catch {}
      }

      // 2. Also handshake with iframe to ensure infoDelivery streams continuously
      const iframe = (iframeRef.current || document.getElementById('ml-shared-yt-player')) as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
        } catch {}
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(initTimer1);
      clearTimeout(initTimer2);
      clearInterval(timer);
    };
  }, [videoId]);

  async function loadInitial() {
    try {
      const def = await api.getSimpleDefault();
      setVideoId(def.videoId || 'OLXSmAhpU-g');
      setTag(def.tag || 'Simmin Bawa Masterclass Replay');
      setHeading(def.heading || 'Highlights from the Call');
      setSubheading(def.subheading || '');
      setKeyPoints(def.keyPoints || []);
      setTimestamps(def.timestamps || []);
      setWordpressHtml(def.wordpressHtml || '');
      if (def.emailData) {
        setEmailData(def.emailData);
        setEmailHtml(def.emailHtml || generateReplayEmailHtml(def.emailData));
      }
    } catch (err) {
      console.error('Failed to load default data:', err);
    }
  }

  // Fetch official transcript directly from YouTube
  async function handleFetchYouTubeTranscript() {
    if (!youtubeUrl) return;
    setFetchingYtTranscript(true);
    setYtTranscriptNotice(null);
    try {
      const info = await api.fetchYouTubeTranscript(youtubeUrl);
      setYtTranscriptInfo(info);
      setUseYouTubeTranscript(true);
      setYtTranscriptNotice(null);
    } catch (err: any) {
      console.warn('YouTube transcript fetch notice:', err.message);
      setYtTranscriptNotice(err.message || 'YouTube restricted automatic transcript request from cloud host.');
    } finally {
      setFetchingYtTranscript(false);
    }
  }

  // Rebuild the embed code when user edits inputs or playerNumber
  function buildEmbedCode(vId: string, currentTag: string, currentHeading: string, currentSubheading: string, pNum: string, tList: TimestampItem[]): string {
    const listHtml = tList.map(t => `        <li>
          <button type="button" onclick="jumpTo${pNum}(${t.seconds})">
            <span>${t.title.replace(/"/g, '&quot;')}</span>
            <strong>${t.formattedTime}</strong>
          </button>
        </li>`).join('\n\n');

    return `<!-- VIDEO SECTION -->
<section class="ml-video-section">

  <div class="ml-video-card">

    <!-- VIDEO -->
    <div class="ml-video-wrapper">
      <div id="ytplayer${pNum}"></div>
    </div>

    <!-- CONTENT -->
    <div class="ml-video-content">

      <div class="ml-video-tag">
        ${currentTag}
      </div>

      <h2 class="ml-video-heading">
        ${currentHeading}
      </h2>

      <p class="ml-video-subheading">
        ${currentSubheading}
      </p>

      <!-- TIMESTAMPS -->
      <ul class="ml-timestamps">

${listHtml}

      </ul>

    </div>

  </div>

</section>


<!-- STYLES -->
<style>

/* =========================
   SECTION
========================= */

.ml-video-section{
    padding:80px 20px;
    background:#f6f1fb;
}


/* =========================
   MAIN CARD
========================= */

.ml-video-card{
    max-width:1200px;
    margin:auto;
    background:linear-gradient(135deg,#ffffff,#faf5ff);
    border-radius:36px;
    overflow:hidden;
    box-shadow:
        0 15px 50px rgba(111,66,193,0.10),
        0 4px 15px rgba(0,0,0,0.04);
    border:1px solid rgba(123,47,247,0.08);
}


/* =========================
   VIDEO
========================= */

.ml-video-wrapper{
    position:relative;
    width:100%;
    aspect-ratio:16 / 9;
    background:#000;
    overflow:hidden;
}

.ml-video-wrapper iframe{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    border:0;
    display:block;
}

#ytplayer${pNum}{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
}


/* =========================
   CONTENT
========================= */

.ml-video-content{
    padding:60px;
    position:relative;
}

.ml-video-content::before{
    content:"";
    position:absolute;
    width:350px;
    height:350px;
    background:rgba(155,89,182,0.06);
    border-radius:50%;
    top:-120px;
    right:-80px;
}


/* =========================
   TAG
========================= */

.ml-video-tag{
    display:inline-block;
    padding:10px 18px;
    background:rgba(111,66,193,0.1);
    color:#6f42c1;
    border-radius:50px;
    font-size:14px;
    font-weight:600;
    letter-spacing:1px;
    margin-bottom:18px;
    position:relative;
    z-index:2;
}


/* =========================
   HEADING
========================= */

.ml-video-heading{
    font-size:58px;
    line-height:1.1;
    color:#4b0082;
    margin:0 0 18px;
    font-family:"Cormorant Garamond",serif;
    position:relative;
    z-index:2;
}

.ml-video-subheading{
    color:#6d5a85;
    font-size:17px;
    line-height:1.9;
    margin:0 0 40px;
    max-width:800px;
    position:relative;
    z-index:2;
}


/* =========================
   TIMESTAMPS
========================= */

.ml-timestamps{
    list-style:none;
    padding:0;
    margin:0;
    position:relative;
    z-index:2;
}

.ml-timestamps li{
    margin-bottom:14px;
}

.ml-timestamps button{
    width:100%;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:20px;

    background:rgba(255,255,255,0.7);

    border:1px solid rgba(123,47,247,0.08);

    padding:18px 22px;

    border-radius:18px;

    cursor:pointer;

    transition:
        transform .3s ease,
        background .3s ease,
        border-color .3s ease,
        box-shadow .3s ease;

    text-align:left;

    backdrop-filter:blur(12px);

    box-shadow:
        0 8px 20px rgba(111,66,193,0.05);

    font-family:inherit;

    appearance:none;
    -webkit-appearance:none;
}

.ml-timestamps button:hover{
    transform:translateY(-3px);
    background:#fff;
    border-color:#c084fc;

    box-shadow:
        0 12px 30px rgba(111,66,193,0.10);
}

.ml-timestamps button:active{
    transform:translateY(0);
}

.ml-timestamps span{
    color:#4d3d66;
    font-size:15px;
    line-height:1.7;
    font-weight:500;
}

.ml-timestamps strong{
    color:#7b2ff7;
    font-size:14px;
    white-space:nowrap;
    font-weight:700;
}


/* =========================
   TABLET
========================= */

@media(max-width:991px){

    .ml-video-content{
        padding:40px 28px;
    }

    .ml-video-heading{
        font-size:42px;
    }

}


/* =========================
   MOBILE
========================= */

@media(max-width:600px){

    .ml-video-section{
        padding:40px 12px;
    }

    .ml-video-card{
        border-radius:26px;
    }

    /*
       Keep YouTube video at its
       natural 16:9 ratio on mobile.
       This prevents the thumbnail/video
       from being cropped.
    */

    .ml-video-wrapper{
        width:100%;
        aspect-ratio:14 / 9;
        height:auto;
        overflow:hidden;
    }

    .ml-video-wrapper iframe{
        width:100% !important;
        height:100% !important;
        display:block;
        border:0;
    }

    #ytplayer${pNum}{
        width:100%;
        height:100%;
    }

    .ml-video-content{
        padding:35px 20px;
    }

    .ml-video-heading{
        font-size:34px;
    }

    .ml-video-subheading{
        font-size:15px;
        line-height:1.8;
    }

    .ml-timestamps button{
        padding:18px 16px;

        display:flex;
        flex-direction:column;

        align-items:flex-start;
        justify-content:flex-start;

        gap:12px;

        text-align:left;
    }

    .ml-timestamps span{
        font-size:15px;
        line-height:1.7;

        width:100%;

        word-break:break-word;
        white-space:normal;
    }

    .ml-timestamps strong{
        margin-top:0;
        font-size:22px;
        line-height:1;
    }

}


/* =========================
   SMALL PHONES
========================= */

@media(max-width:380px){

    .ml-video-section{
        padding-left:8px;
        padding-right:8px;
    }

    .ml-video-content{
        padding:30px 16px;
    }

    .ml-video-heading{
        font-size:31px;
    }

}


/* =========================
   ACCESSIBILITY
========================= */

.ml-timestamps button:focus-visible{
    outline:3px solid rgba(123,47,247,0.35);
    outline-offset:3px;
}

</style>


<!-- YOUTUBE PLAYER API -->
<script>

var ytPlayer${pNum} = null;


/* =========================
   CREATE YOUTUBE PLAYER
========================= */

function loadYouTubePlayer${pNum}() {

    if (ytPlayer${pNum}) {
        return;
    }

    if (typeof YT === "undefined" || typeof YT.Player === "undefined") {
        return;
    }

    ytPlayer${pNum} = new YT.Player('ytplayer${pNum}', {

        videoId: '${vId}',

        playerVars: {
            rel: 0,
            playsinline: 1,
            modestbranding: 1
        },

        events: {

            onReady: function(event) {

                console.log("YouTube Player ${pNum} Ready");

            },

            onError: function(event) {

                console.log("YouTube Player ${pNum} Error:", event.data);

            }

        }

    });

}


/* =========================
   LOAD YOUTUBE IFRAME API
========================= */

if (typeof YT === "undefined" || typeof YT.Player === "undefined") {

    var ytScript${pNum} = document.createElement("script");

    ytScript${pNum}.src = "https://www.youtube.com/iframe_api";

    document.head.appendChild(ytScript${pNum});

}


/* =========================
   YOUTUBE API READY
========================= */

var previousYTReady = window.onYouTubeIframeAPIReady;

window.onYouTubeIframeAPIReady = function() {

    if (typeof previousYTReady === "function") {
        previousYTReady();
    }

    loadYouTubePlayer${pNum}();

};


/* =========================
   IMPORTANT:
   IF API IS ALREADY LOADED
========================= */

if (typeof YT !== "undefined" && typeof YT.Player !== "undefined") {

    loadYouTubePlayer${pNum}();

}


/* =========================
   TIMESTAMP FUNCTION
========================= */

function jumpTo${pNum}(seconds) {

    if (!ytPlayer${pNum} || typeof ytPlayer${pNum}.seekTo !== "function") {
        return;
    }

    var targetTime = Math.max(0, seconds);

    ytPlayer${pNum}.seekTo(targetTime, true);
    ytPlayer${pNum}.playVideo();

    setTimeout(function() {
        if (ytPlayer${pNum} && typeof ytPlayer${pNum}.playVideo === "function") {
            ytPlayer${pNum}.playVideo();
        }
    }, 100);

    setTimeout(function() {
        if (ytPlayer${pNum} && typeof ytPlayer${pNum}.playVideo === "function") {
            ytPlayer${pNum}.playVideo();
        }
    }, 300);

    /*
       Scroll back to the video
       after clicking a timestamp.
    */

    var videoSection = document.querySelector("#ytplayer${pNum}") || document.querySelector(".ml-video-wrapper");

    if (videoSection) {

        videoSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

}

</script>`;
  }

  // Handle generation when user submits form
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('masterclassName', masterclassName.trim());
      formData.append('youtubeUrl', youtubeUrl.trim());
      formData.append('playerNumber', playerNumber.trim() || '1');
      formData.append('useYouTubeTranscript', String(useYouTubeTranscript));

      if (startOffset.trim()) {
        const offsetSec = parseTimeStringToSeconds(startOffset.trim());
        formData.append('startOffsetSeconds', String(offsetSec));
      }
      if (file) formData.append('file', file);
      if (transcriptText) formData.append('transcriptText', transcriptText);

      const res = await api.generateSimpleWordPress(formData);

      const computedTag = `${masterclassName.trim()} Replay`;
      setVideoId(res.videoId || 'OLXSmAhpU-g');
      setTag(computedTag);
      setHeading(res.heading || 'Highlights from the Call');
      setSubheading(res.subheading || `Explore powerful healing experiences, energy alignments, group healings, and transformational breakthroughs from ${masterclassName}.`);
      setKeyPoints(res.keyPoints || []);
      setTimestamps(res.timestamps || []);
      setWordpressHtml(res.wordpressHtml || '');
      if (res.offsetSeconds) {
        setDetectedOffset(res.offsetSeconds);
      }
      if (res.source) {
        setLastGenerationSource(res.source);
      }
      if (res.cueCount) {
        setLastCueCount(res.cueCount);
      }
      if (res.emailData) {
        setEmailData(res.emailData);
        setEmailHtml(res.emailHtml || generateReplayEmailHtml(res.emailData));
      } else {
        syncEmailFromTimestamps(res.timestamps || []);
      }
      setActiveTab('preview');
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Seek video to exact timestamp and automatically play
  function handlePreviewTimestampClick(seconds: number) {
    const targetSec = Math.max(0, seconds);
    setActiveTimestampSec(targetSec);

    // 1. Scroll back to video player smoothly
    if (videoWrapperRef.current) {
      videoWrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 2. Direct seek via YouTube Player API if ready
    if (isPlayerReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      try {
        ytPlayerRef.current.seekTo(targetSec, true);
      } catch {}
    }

    // 3. Always also seek via iframe postMessage
    const iframe = (iframeRef.current || document.getElementById('ml-shared-yt-player')) as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [targetSec, true] }),
          '*'
        );
      } catch {}
    }

    // 4. GUARANTEED PLAYBACK:
    // When seeking, YouTube transitions into buffering (state 3) which drops synchronous play calls.
    // Dispatched immediately, after 80ms, and after 250ms via both the Player API and postMessage.
    const startPlayback = () => {
      try {
        if (isPlayerReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
          ytPlayerRef.current.playVideo();
        }
      } catch {}

      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
            '*'
          );
        } catch {}
      }
      setIsPlaying(true);
    };

    startPlayback();
    setTimeout(startPlayback, 80);
    setTimeout(startPlayback, 250);
  }

  // Set selected timestamp row to the video's EXACT playback position
  function handleSyncToCurrentVideoTime(index: number) {
    let exactSec = 0;

    // 1. Query YouTube Player API directly at click moment
    if (isPlayerReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      try {
        const t = ytPlayerRef.current.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t) && t >= 0) {
          exactSec = Math.floor(t);
        }
      } catch {}
    }

    // 2. Check playerTimeRef (updated in real-time from infoDelivery & polling)
    if (exactSec <= 0 && playerTimeRef.current > 0) {
      exactSec = playerTimeRef.current;
    }

    // 3. Fallback to continuous live playhead tracker
    if (exactSec <= 0 && currentVideoPlayTime > 0) {
      exactSec = currentVideoPlayTime;
    }

    handleTimestampChange(index, 'seconds', exactSec);
    setSyncedRowIdx(index);
    setTimeout(() => setSyncedRowIdx(null), 1800);
  }

  // Play / Pause video in Editor
  function handleTogglePlay() {
    const shouldPlay = !isPlaying;
    if (isPlayerReadyRef.current && ytPlayerRef.current) {
      try {
        if (shouldPlay) {
          ytPlayerRef.current.playVideo();
        } else {
          ytPlayerRef.current.pauseVideo();
        }
        setIsPlaying(shouldPlay);
        return;
      } catch {}
    }

    const iframe = (iframeRef.current || document.getElementById('ml-shared-yt-player')) as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: shouldPlay ? 'playVideo' : 'pauseVideo', args: [] }),
          '*'
        );
      } catch {}
      setIsPlaying(shouldPlay);
    }
  }

  // Step video forward or backward by delta seconds
  function handleStepTime(deltaSeconds: number) {
    let cur = currentVideoPlayTime;
    if (isPlayerReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      try {
        const t = ytPlayerRef.current.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t)) cur = Math.floor(t);
      } catch {}
    } else if (playerTimeRef.current > 0) {
      cur = playerTimeRef.current;
    }
    const target = Math.max(0, cur + deltaSeconds);
    handlePreviewTimestampClick(target);
  }

  // Sort timestamps chronologically
  function handleSortChronological() {
    const sorted = [...timestamps].sort((a, b) => a.seconds - b.seconds);
    setTimestamps(sorted);
    const code = buildEmbedCode(videoId, tag, heading, subheading, playerNumber, sorted);
    setWordpressHtml(code);
    syncEmailFromTimestamps(sorted);
  }

  // Drag and Drop reordering handlers
  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...timestamps];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(targetIndex, 0, moved);
    setTimestamps(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);

    const code = buildEmbedCode(videoId, tag, heading, subheading, playerNumber, updated);
    setWordpressHtml(code);
    syncEmailFromTimestamps(updated);
  }

  function handleDragEnd() {
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  // Add a new timestamp anchored to current video playback time
  function handleAddTimestampAtCurrentTime() {
    let sec = currentVideoPlayTime > 0 ? currentVideoPlayTime : (playerTimeRef.current > 0 ? playerTimeRef.current : 0);
    if (isPlayerReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      try {
        const t = ytPlayerRef.current.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t)) sec = Math.floor(t);
      } catch {}
    } else if (playerTimeRef.current > 0) {
      sec = playerTimeRef.current;
    }
    const formatted = formatSecondsToTimeString(sec);
    const updated = [
      ...timestamps,
      { title: 'New Masterclass Highlight', seconds: sec, formattedTime: formatted }
    ].sort((a, b) => a.seconds - b.seconds);
    setTimestamps(updated);
    const code = buildEmbedCode(videoId, tag, heading, subheading, playerNumber, updated);
    setWordpressHtml(code);
    syncEmailFromTimestamps(updated);
  }

  // Copy WordPress code to clipboard
  function handleCopy() {
    navigator.clipboard.writeText(wordpressHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // Manual timestamp editing in Editor tab with bidirectional auto-sync
  function handleTimestampChange(index: number, field: keyof TimestampItem, value: any) {
    const updated = [...timestamps];
    const item = { ...updated[index] };

    if (field === 'formattedTime') {
      item.formattedTime = value;
      const parsedSec = parseTimeStringToSeconds(value);
      if (!isNaN(parsedSec)) {
        item.seconds = parsedSec;
      }
    } else if (field === 'seconds') {
      const numSec = Math.max(0, parseInt(value || '0', 10));
      item.seconds = numSec;
      item.formattedTime = formatSecondsToTimeString(numSec);
    } else {
      item[field] = value;
    }

    updated[index] = item;
    setTimestamps(updated);
    const code = buildEmbedCode(videoId, tag, heading, subheading, playerNumber, updated);
    setWordpressHtml(code);
    syncEmailFromTimestamps(updated);
  }

  function handleAddTimestamp() {
    const updated = [
      ...timestamps,
      { title: 'New Highlight Moment', seconds: 0, formattedTime: '00:00' }
    ];
    setTimestamps(updated);
    const code = buildEmbedCode(videoId, tag, heading, subheading, playerNumber, updated);
    setWordpressHtml(code);
    syncEmailFromTimestamps(updated);
  }

  function handleDeleteTimestamp(index: number) {
    const updated = timestamps.filter((_, i) => i !== index);
    setTimestamps(updated);
    const code = buildEmbedCode(videoId, tag, heading, subheading, playerNumber, updated);
    setWordpressHtml(code);
    syncEmailFromTimestamps(updated);
  }

  // Synchronize Email Data when timestamps or masterclass changes
  function syncEmailFromTimestamps(tList: TimestampItem[]) {
    const emojis = ['🌏', '🌸', '✨', '🕊️', '💫', '💖', '🌟', '🔮'];
    const updatedMoments: EmailMoment[] = tList.slice(0, 7).map((t, i) => ({
      formattedTime: t.formattedTime,
      title: t.title,
      emoji: (emailData?.keyMoments && emailData.keyMoments[i]?.emoji) || emojis[i % emojis.length],
      description: (emailData?.keyMoments && emailData.keyMoments[i]?.description) || 'Watch this powerful channeled energy shift and insight from the session.'
    }));

    const newEmail: ReplayEmailData = {
      masterclassName,
      speakerName: emailData?.speakerName || 'Simmin Bawa',
      videoId,
      replayUrl: `https://www.youtube.com/watch?v=${videoId}`,
      bookingUrl: emailData?.bookingUrl || 'https://themysticlotus.com/booking',
      subject: emailData?.subject || `${masterclassName} [Replay Inside]`,
      previewText: emailData?.previewText || "Some experiences can't be explained. They can only be felt. Highlights inside.",
      hookText: emailData?.hookText || `Some experiences can't be explained. They can only be felt. On our recent live call with Expert Healer-Trainer <strong>${emailData?.speakerName || 'Simmin Bawa'}</strong>, the <strong>${masterclassName}</strong> became a space of deep healing, surrender, and connection.`,
      attendeeQuotes: emailData?.attendeeQuotes && emailData.attendeeQuotes.length > 0
        ? emailData.attendeeQuotes
        : [
            {
              quote: 'Energy lifted as soon as we reached the Bodhi tree. Could see into his luminous eyes. He asked me to continue. The Buddha sent his blessings to you.',
              attendeeName: 'Sonalika'
            },
            {
              quote: 'Shivji removed a lot of the emotional pain. I feel heavy but relieved at the same time.',
              attendeeName: 'Sarika'
            },
            {
              quote: 'I saw black light coming out of my crown chakra. Released my negative emotions.',
              attendeeName: 'Arpana Supriya'
            },
            {
              quote: 'With Ganga water he washed my negativity from above and blessed me. Ma Ganesh, Kartikeya and Nandi were there. Panchmukhi Hanuman...',
              attendeeName: 'Bhavna Shah'
            }
          ],
      keyMoments: updatedMoments
    };

    setEmailData(newEmail);
    setEmailHtml(generateReplayEmailHtml(newEmail));
  }

  function handleUpdateEmailField(field: keyof ReplayEmailData, value: any) {
    if (!emailData) return;
    const newEmail: ReplayEmailData = { ...emailData, [field]: value };
    setEmailData(newEmail);
    setEmailHtml(generateReplayEmailHtml(newEmail));
  }

  function handleQuoteChange(idx: number, field: 'quote' | 'attendeeName', val: string) {
    if (!emailData) return;
    const quotes = [...(emailData.attendeeQuotes || [])];
    quotes[idx] = { ...quotes[idx], [field]: val };
    handleUpdateEmailField('attendeeQuotes', quotes);
  }

  function handleAddQuote() {
    if (!emailData) return;
    const quotes = [...(emailData.attendeeQuotes || []), { quote: 'Channeled healing shifted my energy immediately.', attendeeName: 'Attendee' }];
    handleUpdateEmailField('attendeeQuotes', quotes);
  }

  function handleDeleteQuote(idx: number) {
    if (!emailData) return;
    const quotes = (emailData.attendeeQuotes || []).filter((_, i) => i !== idx);
    handleUpdateEmailField('attendeeQuotes', quotes);
  }

  function handleCopyEmailHtml() {
    navigator.clipboard.writeText(emailHtml);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2500);
  }

  function handleCopySubjectPreview() {
    if (!emailData) return;
    const text = `Subject: ${emailData.subject || ''}\nPreview Text: ${emailData.previewText || ''}`;
    navigator.clipboard.writeText(text);
    setEmailSubjCopied(true);
    setTimeout(() => setEmailSubjCopied(false), 2500);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F5FB', padding: '24px 20px 80px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        {/* Top Studio Brand Header */}
        <header style={{
          background: 'linear-gradient(135deg, #FAF5FF, #FFFFFF)',
          border: '1px solid rgba(123,47,247,0.15)',
          borderRadius: 24,
          padding: '24px 32px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 30px rgba(111,66,193,0.06)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                background: 'linear-gradient(135deg, #7b2ff7, #6f42c1)',
                color: '#FFFFFF',
                width: 32,
                height: 32,
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 12px rgba(123,47,247,0.3)'
              }}>
                <Sparkles size={18} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: '#7b2ff7', textTransform: 'uppercase' }}>
                Mystic Lotus & Dragonflies
              </span>
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', color: '#2D1B4E', fontSize: 26, margin: 0, fontWeight: 700 }}>
              Masterclass Replay Code Generator
            </h1>
            <p style={{ color: '#6D5A85', fontSize: 14, margin: '4px 0 0' }}>
              Add YouTube Link, Masterclass Name & Transcript &rarr; AI generates clickable timestamps & WordPress code.
            </p>
          </div>

          <button
            onClick={handleCopy}
            style={{
              background: copied ? '#10B981' : '#7b2ff7',
              color: '#FFFFFF',
              border: 0,
              borderRadius: 14,
              padding: '14px 26px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 8px 24px rgba(123,47,247,0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'WordPress Code Copied!' : 'Copy WordPress Code'}
          </button>
        </header>

        {/* 2-Column Workspace Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24, alignItems: 'start' }}>

          {/* Left Column: Input Panel */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E9D5FF',
            borderRadius: 24,
            padding: 26,
            boxShadow: '0 4px 20px rgba(111,66,193,0.04)'
          }}>
            <h2 style={{ fontSize: 17, color: '#3B1E63', margin: '0 0 18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#7b2ff7" /> Session Inputs
            </h2>

            <form onSubmit={handleGenerate}>
              {/* 1. Masterclass Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#3A2E4C', marginBottom: 6 }}>
                  1. Masterclass Name
                </label>
                <input
                  type="text"
                  value={masterclassName}
                  onChange={e => {
                    setMasterclassName(e.target.value);
                    setTag(`${e.target.value} Replay`);
                  }}
                  placeholder="e.g. Simmin Bawa Masterclass - Day 2"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid #D8B4FE',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#FAF8FC',
                    color: '#2D1B4E',
                    fontWeight: 500
                  }}
                />
              </div>

              {/* 2. YouTube Video Link */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#3A2E4C', marginBottom: 6 }}>
                  2. YouTube Video Link
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={e => {
                    const val = e.target.value;
                    setYoutubeUrl(val);
                    setYtTranscriptInfo(null);
                    setYtTranscriptNotice(null);
                    const vId = parseYouTubeId(val);
                    if (vId) {
                      setVideoId(vId);
                    }
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid #D8B4FE',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#FAF8FC',
                    color: '#2D1B4E'
                  }}
                />

                {/* Direct YouTube Transcript Fetcher */}
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={handleFetchYouTubeTranscript}
                    disabled={fetchingYtTranscript || !youtubeUrl}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 10,
                      background: ytTranscriptInfo ? '#ECFDF5' : '#FAF5FF',
                      border: ytTranscriptInfo ? '1.5px solid #10B981' : '1px solid #C084FC',
                      color: ytTranscriptInfo ? '#065F46' : '#7b2ff7',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {fetchingYtTranscript ? (
                      <><RefreshCw className="spinner" size={13} /> Detecting Official YouTube Captions...</>
                    ) : ytTranscriptInfo ? (
                      <><Check size={14} color="#10B981" /> Official YouTube Transcript Loaded ({ytTranscriptInfo.totalCues.toLocaleString()} Cues Ready)</>
                    ) : (
                      <><Sparkles size={13} /> Auto-Detect Official YouTube Captions</>
                    )}
                  </button>

                  {ytTranscriptInfo && (
                    <div style={{
                      marginTop: 6,
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 11,
                      color: '#166534',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>🟢 <strong>100% Video-Synced:</strong> Cues match YouTube player to the exact second.</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={useYouTubeTranscript}
                          onChange={e => setUseYouTubeTranscript(e.target.checked)}
                        /> Use as Primary
                      </label>
                    </div>
                  )}

                  {ytTranscriptNotice && (
                    <div style={{
                      marginTop: 8,
                      background: '#FFFBEB',
                      border: '1.5px solid #FCD34D',
                      borderRadius: 12,
                      padding: '12px 14px',
                      fontSize: 12,
                      color: '#92400E',
                      lineHeight: 1.5
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>💡</span>
                        <div style={{ flex: 1 }}>
                          <strong style={{ color: '#78350F' }}>YouTube Captions Status:</strong>
                          <p style={{ margin: '3px 0 8px 0', fontSize: 11.5 }}>
                            YouTube cloud scraper restriction. Choose one of two easy options:
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{
                              background: '#FEF3C7',
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: '1px dashed #F59E0B',
                              fontSize: 11.5
                            }}>
                              <strong>Option 1 (Fastest):</strong> Click the purple <strong>Generate Replay Code</strong> button below — AI will create all highlights &amp; timestamps directly!
                            </div>
                            <div style={{
                              background: '#F5F3FF',
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: '1px solid #DDD6FE',
                              fontSize: 11.5,
                              color: '#5B21B6'
                            }}>
                              <strong>Option 2:</strong> Upload Zoom transcript in <strong>Step 4</strong>, or{' '}
                              <a
                                href={youtubeUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#7C3AED', fontWeight: 700, textDecoration: 'underline' }}
                              >
                                open YouTube video
                              </a>
                              {' '}and copy captions into the box.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Player Number Selector */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#3A2E4C' }}>
                    3. YouTube Player ID Number
                  </label>
                  <span style={{ fontSize: 11, color: '#7b2ff7', fontWeight: 600 }}>ytplayer{playerNumber}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {['1', '2', '3', '5'].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setPlayerNumber(num);
                        const code = buildEmbedCode(videoId, tag, heading, subheading, num, timestamps);
                        setWordpressHtml(code);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        borderRadius: 10,
                        border: playerNumber === num ? '2px solid #7b2ff7' : '1px solid #D8B4FE',
                        background: playerNumber === num ? '#FAF5FF' : '#FFFFFF',
                        color: playerNumber === num ? '#7b2ff7' : '#6B5E7D',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      Player {num}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={playerNumber}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setPlayerNumber(val || '1');
                    const code = buildEmbedCode(videoId, tag, heading, subheading, val || '1', timestamps);
                    setWordpressHtml(code);
                  }}
                  placeholder="Or enter custom number (e.g. 4)"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #E9D5FF',
                    fontSize: 12,
                    boxSizing: 'border-box',
                    color: '#6B5E7D'
                  }}
                />
              </div>

              {/* Optional: Zoom Pre-Call Waiting Room Offset */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#3A2E4C' }}>
                    Pre-Call Offset (Optional)
                  </label>
                  <span style={{ fontSize: 11, color: '#7b2ff7' }}>Auto-detected from transcript</span>
                </div>
                <input
                  type="text"
                  value={startOffset}
                  onChange={e => setStartOffset(e.target.value)}
                  placeholder="e.g. 21:55 or leave blank for auto"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #E9D5FF',
                    fontSize: 12,
                    boxSizing: 'border-box',
                    color: '#6B5E7D',
                    background: '#FAF8FC'
                  }}
                />
                {detectedOffset !== null && detectedOffset > 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#059669', fontWeight: 600 }}>
                    ✓ Auto-synchronized: {formatSecondsToTimeString(detectedOffset)} pre-call offset applied.
                  </p>
                )}
              </div>

              {/* 4. Upload Transcript */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#3A2E4C', marginBottom: 6 }}>
                  4. Upload Transcript File
                </label>
                <div style={{
                  border: '2px dashed #D8B4FE',
                  borderRadius: 12,
                  padding: '16px',
                  textAlign: 'center',
                  background: '#FCFAFF',
                  cursor: 'pointer'
                }}>
                  <Upload size={22} color="#7b2ff7" style={{ margin: '0 auto 6px' }} />
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#5B4F6D', fontWeight: 600 }}>
                    {file ? file.name : 'Choose .txt, .vtt, .srt, .docx, or .pdf'}
                  </p>
                  <input
                    type="file"
                    accept=".txt,.vtt,.srt,.docx,.pdf"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 11, color: '#6d5a85', width: '100%', marginTop: 6 }}
                  />
                </div>
              </div>

              {/* Optional: Paste Text Directly */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6D5A85', marginBottom: 4 }}>
                  Or Paste Transcript Text:
                </label>
                <textarea
                  rows={4}
                  value={transcriptText}
                  onChange={e => setTranscriptText(e.target.value)}
                  placeholder="Paste transcript cues or raw text here..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #D8B4FE',
                    fontSize: 11,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                    background: '#FAF8FC'
                  }}
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: 14,
                  background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #7b2ff7, #6f42c1)',
                  color: '#FFFFFF',
                  border: 0,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 6px 18px rgba(123,47,247,0.3)',
                  transition: 'transform 0.15s ease'
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="spinner" size={18} /> Generating Timestamps & Code...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Generate Replay Code
                  </>
                )}
              </button>
            </form>

            {/* AI Key Highlights Preview */}
            {keyPoints.length > 0 && (
              <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #F3E8FF' }}>
                <h3 style={{ fontSize: 13, color: '#4b0082', margin: '0 0 10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Key Points Selected by AI:
                </h3>
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12, color: '#4D3D66', lineHeight: 1.6 }}>
                  {keyPoints.map((kp, idx) => (
                    <li key={idx} style={{ marginBottom: 6 }}>{kp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column: Live Output, Clickable Preview, Drag Editor & Email */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E9D5FF',
            borderRadius: 24,
            padding: 26,
            boxShadow: '0 4px 20px rgba(111,66,193,0.04)'
          }}>
            {/* View Tabs */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #E9D5FF',
              paddingBottom: 14,
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: 0,
                    background: activeTab === 'preview' ? '#7b2ff7' : '#FAF5FF',
                    color: activeTab === 'preview' ? '#FFFFFF' : '#6B5E7D',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Eye size={15} /> Clickable Player Preview ({timestamps.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: 0,
                    background: activeTab === 'editor' ? '#7b2ff7' : '#FAF5FF',
                    color: activeTab === 'editor' ? '#FFFFFF' : '#6B5E7D',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <FileText size={15} /> Edit Timestamps
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('email')}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: 0,
                    background: activeTab === 'email' ? '#7b2ff7' : '#FAF5FF',
                    color: activeTab === 'email' ? '#FFFFFF' : '#6B5E7D',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Mail size={15} /> 📧 Replay Email Content
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: 0,
                    background: activeTab === 'code' ? '#7b2ff7' : '#FAF5FF',
                    color: activeTab === 'code' ? '#FFFFFF' : '#6B5E7D',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Code size={15} /> WordPress HTML Code
                </button>
              </div>

              {activeTab === 'email' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleCopySubjectPreview}
                    style={{
                      background: emailSubjCopied ? '#10B981' : '#FAF5FF',
                      color: emailSubjCopied ? '#FFFFFF' : '#7b2ff7',
                      border: '1px solid rgba(123,47,247,0.3)',
                      borderRadius: 10,
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {emailSubjCopied ? <Check size={13} /> : <Copy size={13} />}
                    {emailSubjCopied ? 'Subject Copied!' : 'Copy Subject & Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyEmailHtml}
                    style={{
                      background: emailCopied ? '#10B981' : '#7b2ff7',
                      color: '#FFFFFF',
                      border: 0,
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 4px 14px rgba(123,47,247,0.2)'
                    }}
                  >
                    {emailCopied ? <Check size={14} /> : <Copy size={14} />}
                    {emailCopied ? 'Email HTML Copied!' : 'Copy Email HTML'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    background: copied ? '#10B981' : '#FAF5FF',
                    color: copied ? '#FFFFFF' : '#7b2ff7',
                    border: '1px solid rgba(123,47,247,0.3)',
                    borderRadius: 10,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              )}
            </div>

            {/* SHARED PERSISTENT VIDEO PLAYER FOR PREVIEW AND EDITOR */}
            <div style={{
              display: (activeTab === 'preview' || activeTab === 'editor') ? 'block' : 'none',
              marginBottom: 24
            }}>
              <div
                ref={videoWrapperRef}
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/9',
                  background: '#000',
                  borderRadius: 20,
                  overflow: 'hidden',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.14)'
                }}
              >
                <iframe
                  id="ml-shared-yt-player"
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&version=3&rel=0&playsinline=1&origin=${encodeURIComponent(typeof window !== 'undefined' && window.location.origin ? window.location.origin : '')}`}
                  title="Masterclass Replay Video Player"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>

                {/* Real-time Playhead & Playback Verification Toolbar (in Editor) */}
                {activeTab === 'editor' && (
                  <div style={{
                    marginTop: 12,
                    padding: '12px 18px',
                    background: 'linear-gradient(135deg, #FAF5FF, #F3E8FF)',
                    borderRadius: 16,
                    border: '1.5px solid #D8B4FE',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    boxShadow: '0 4px 16px rgba(123,47,247,0.06)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Live Playhead Indicator */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#FFFFFF',
                        padding: '6px 14px',
                        borderRadius: 10,
                        border: '1px solid #C084FC',
                        boxShadow: '0 2px 8px rgba(123,47,247,0.08)'
                      }}>
                        <span style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: isPlaying ? '#10B981' : '#F59E0B',
                          boxShadow: isPlaying ? '0 0 8px #10B981' : 'none'
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#3A2E4C' }}>
                          Video Playhead:
                        </span>
                        <strong style={{ fontSize: 14, fontFamily: 'monospace', color: '#7b2ff7' }}>
                          {formatSecondsToTimeString(currentVideoPlayTime)}
                        </strong>
                        <span style={{ fontSize: 11, color: '#888' }}>({currentVideoPlayTime}s)</span>
                      </div>

                      {/* Quick Playback Verification Buttons */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleStepTime(-5)}
                          title="Seek -5 seconds"
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #D8B4FE',
                            borderRadius: 8,
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#6D28D9',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                        >
                          <Rewind size={12} /> -5s
                        </button>
                        <button
                          type="button"
                          onClick={handleTogglePlay}
                          title={isPlaying ? 'Pause Video' : 'Play Video'}
                          style={{
                            background: '#7b2ff7',
                            border: 0,
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {isPlaying ? <><Pause size={12} fill="#FFFFFF" /> Pause</> : <><Play size={12} fill="#FFFFFF" /> Play</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStepTime(5)}
                          title="Seek +5 seconds"
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #D8B4FE',
                            borderRadius: 8,
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#6D28D9',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                        >
                          <FastForward size={12} /> +5s
                        </button>
                      </div>
                    </div>

                    {/* Toolbar Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleSortChronological}
                        title="Sort timestamps in chronological order"
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #C4B5FD',
                          color: '#6D28D9',
                          borderRadius: 10,
                          padding: '7px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <ArrowUpDown size={13} /> Sort Chronologically
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTimestampAtCurrentTime}
                        title={`Add new timestamp at current video time (${formatSecondsToTimeString(currentVideoPlayTime)})`}
                        style={{
                          background: '#7b2ff7',
                          color: '#FFFFFF',
                          border: 0,
                          borderRadius: 10,
                          padding: '7px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 4px 12px rgba(123,47,247,0.2)'
                        }}
                      >
                        <Target size={13} /> Add at Playhead ({formatSecondsToTimeString(currentVideoPlayTime)})
                      </button>
                    </div>
                  </div>
                )}
              </div>

            {/* TAB 1: LIVE INTERACTIVE PREVIEW WITH CLICKABLE TIMESTAMPS */}
            {activeTab === 'preview' && (
              <div style={{ background: '#f6f1fb', padding: '30px 20px', borderRadius: 28 }}>
                <div style={{
                  maxWidth: 900,
                  margin: '0 auto',
                  background: 'linear-gradient(135deg, #ffffff, #faf5ff)',
                  borderRadius: 32,
                  overflow: 'hidden',
                  boxShadow: '0 15px 50px rgba(111,66,193,0.10)',
                  border: '1px solid rgba(123,47,247,0.08)',
                  padding: '40px 32px'
                }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '8px 18px',
                    background: 'rgba(111,66,193,0.1)',
                    color: '#6f42c1',
                    borderRadius: 50,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 1,
                    marginBottom: 16
                  }}>
                    {tag}
                  </div>

                  <h2 style={{
                    fontSize: 38,
                    lineHeight: 1.15,
                    color: '#4b0082',
                    margin: '0 0 16px',
                    fontFamily: '"Cormorant Garamond", Georgia, serif'
                  }}>
                    {heading}
                  </h2>

                  <p style={{
                    color: '#6d5a85',
                    fontSize: 16,
                    lineHeight: 1.8,
                    margin: '0 0 32px',
                    maxWidth: 800
                  }}>
                    {subheading}
                  </p>

                  <div style={{
                    background: 'rgba(123,47,247,0.05)',
                    padding: '10px 16px',
                    borderRadius: 10,
                    marginBottom: 18,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: '#6f42c1'
                  }}>
                    <Play size={14} /> <strong>Click any timestamp below to jump the video directly to that moment:</strong>
                  </div>

                  {/* Clickable Timestamps List */}
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {timestamps.map((t, idx) => {
                      const isCurrent = activeTimestampSec === t.seconds;
                      return (
                        <li key={idx} style={{ marginBottom: 12 }}>
                          <button
                            type="button"
                            onClick={() => handlePreviewTimestampClick(t.seconds)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 20,
                              background: isCurrent ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                              border: isCurrent ? '2px solid #7b2ff7' : '1px solid rgba(123,47,247,0.08)',
                              padding: '16px 20px',
                              borderRadius: 16,
                              cursor: 'pointer',
                              textAlign: 'left',
                              boxShadow: isCurrent ? '0 10px 25px rgba(123,47,247,0.15)' : '0 6px 16px rgba(111,66,193,0.04)',
                              transition: 'all 0.2s ease',
                              transform: isCurrent ? 'translateY(-2px)' : 'none'
                            }}
                          >
                            <span style={{ color: '#4d3d66', fontSize: 14, lineHeight: 1.6, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Play size={13} color={isCurrent ? '#7b2ff7' : '#9C8EB9'} />
                              {t.title}
                            </span>
                            <strong style={{ color: '#7b2ff7', fontSize: 14, whiteSpace: 'nowrap', fontWeight: 700 }}>
                              {t.formattedTime}
                            </strong>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 2: EDIT TIMESTAMPS WITH DRAG & DROP AND EXACT SYNC */}
            {activeTab === 'editor' && (
              <div>
                <div style={{
                  background: '#FAF5FF',
                  border: '1px solid #D8B4FE',
                  borderRadius: 14,
                  padding: '14px 18px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ fontSize: 13, color: '#5B21B6', lineHeight: 1.5 }}>
                    ✨ <strong>Live Precision & Reordering:</strong> Drag rows using the <strong>⠿ grip</strong> to reorder. Play or pause the video to your desired spot, then click <strong>🎯 Sync</strong> on any row to set its exact second.
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTimestamp}
                    style={{
                      background: '#7b2ff7',
                      color: '#FFFFFF',
                      border: 0,
                      borderRadius: 10,
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Plus size={14} /> Add Blank
                  </button>
                </div>

                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 95px 80px 85px 85px 32px',
                  gap: 8,
                  padding: '6px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6D5A85',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>
                  <div style={{ textAlign: 'center' }}>⠿</div>
                  <div>Highlight Title</div>
                  <div style={{ textAlign: 'center' }}>Time (MM:SS)</div>
                  <div style={{ textAlign: 'center' }}>Seconds</div>
                  <div style={{ textAlign: 'center' }}>Verify Seek</div>
                  <div style={{ textAlign: 'center' }}>Pin Exact</div>
                  <div style={{ textAlign: 'center' }}>Del</div>
                </div>

                {/* Draggable Timestamps List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {timestamps.map((t, idx) => {
                    const isCurrent = activeTimestampSec === t.seconds;
                    const isDragging = draggedIdx === idx;
                    const isDragOver = dragOverIdx === idx;

                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={e => handleDragStart(e, idx)}
                        onDragOver={e => handleDragOver(e, idx)}
                        onDrop={e => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '28px 1fr 95px 80px 85px 85px 32px',
                          gap: 8,
                          alignItems: 'center',
                          background: isDragOver ? '#F3E8FF' : isCurrent ? '#FFFFFF' : '#FAF8FC',
                          padding: '10px 14px',
                          borderRadius: 12,
                          border: isDragOver
                            ? '2px dashed #7b2ff7'
                            : isCurrent
                            ? '1.5px solid #7b2ff7'
                            : '1px solid #EBE4F3',
                          boxShadow: isCurrent ? '0 4px 14px rgba(123,47,247,0.1)' : 'none',
                          opacity: isDragging ? 0.35 : 1,
                          transition: 'border 0.15s ease, background 0.15s ease'
                        }}
                      >
                        {/* Drag Handle */}
                        <div
                          style={{
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#9CA3AF',
                            padding: '4px 0'
                          }}
                          title="Drag to reorder timestamp"
                        >
                          <GripVertical size={16} />
                        </div>

                        {/* Title Input */}
                        <input
                          type="text"
                          value={t.title}
                          onChange={e => handleTimestampChange(idx, 'title', e.target.value)}
                          placeholder="Timestamp title"
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid #D8B4FE',
                            fontSize: 13,
                            outline: 'none',
                            background: '#FFFFFF'
                          }}
                        />

                        {/* Formatted Time Input */}
                        <input
                          type="text"
                          value={t.formattedTime}
                          onChange={e => handleTimestampChange(idx, 'formattedTime', e.target.value)}
                          placeholder="MM:SS"
                          title="Type time (e.g. 19:04 or 1:18:56). Seconds will update automatically."
                          style={{
                            padding: '8px 6px',
                            borderRadius: 8,
                            border: '1px solid #D8B4FE',
                            fontSize: 13,
                            textAlign: 'center',
                            fontWeight: 700,
                            color: '#7b2ff7',
                            outline: 'none',
                            background: '#FFFFFF'
                          }}
                        />

                        {/* Seconds Input */}
                        <input
                          type="number"
                          value={t.seconds}
                          onChange={e => handleTimestampChange(idx, 'seconds', e.target.value)}
                          placeholder="Seconds"
                          title="Type seconds (e.g. 1144). Time string will update automatically."
                          style={{
                            padding: '8px 6px',
                            borderRadius: 8,
                            border: '1px solid #D8B4FE',
                            fontSize: 12,
                            textAlign: 'center',
                            outline: 'none',
                            background: '#FFFFFF'
                          }}
                        />

                        {/* Seek Button */}
                        <button
                          type="button"
                          onClick={() => handlePreviewTimestampClick(t.seconds)}
                          title="Play video at this timestamp"
                          style={{
                            background: isCurrent ? '#7b2ff7' : '#FAF5FF',
                            border: '1px solid #C084FC',
                            color: isCurrent ? '#FFFFFF' : '#7b2ff7',
                            borderRadius: 8,
                            padding: '7px 6px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 3,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <Play size={11} fill={isCurrent ? '#FFFFFF' : '#7b2ff7'} /> Seek
                        </button>

                        {/* Exact Sync Button */}
                        <button
                          type="button"
                          onClick={() => handleSyncToCurrentVideoTime(idx)}
                          title={`Set timestamp to current video playhead (${formatSecondsToTimeString(currentVideoPlayTime)})`}
                          style={{
                            background: syncedRowIdx === idx ? '#DCFCE7' : '#EDE9FE',
                            border: syncedRowIdx === idx ? '1.5px solid #16A34A' : '1.5px solid #8B5CF6',
                            color: syncedRowIdx === idx ? '#15803D' : '#5B21B6',
                            borderRadius: 8,
                            padding: '7px 6px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {syncedRowIdx === idx ? (
                            <>
                              <Check size={12} color="#16A34A" /> Synced!
                            </>
                          ) : (
                            <>
                              <Target size={12} color="#7C3AED" /> Sync
                            </>
                          )}
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteTimestamp(idx)}
                          title="Delete timestamp"
                          style={{
                            background: 'none',
                            border: 0,
                            color: '#EF4444',
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: REPLAY EMAIL CONTENT (MATCHING REFERENCE EMAIL FORMAT) */}
            {activeTab === 'email' && (
              <div>
                {/* Header Action Banner */}
                <div style={{
                  background: 'linear-gradient(135deg, #FAF5FF, #F0FDFA)',
                  border: '1px solid #99F6E4',
                  borderRadius: 16,
                  padding: '16px 20px',
                  marginBottom: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#0F766E', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Mail size={18} color="#0D9488" /> Masterclass Replay Email Newsletter
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#134E4A' }}>
                      Ready to send in <strong>Mailchimp, ConvertKit, ActiveCampaign</strong>, etc. Matches the Mystic Lotus reference styling.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setEmailViewMode('visual')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: '1px solid #0D9488',
                        background: emailViewMode === 'visual' ? '#0D9488' : '#FFFFFF',
                        color: emailViewMode === 'visual' ? '#FFFFFF' : '#0D9488',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Eye size={13} /> Visual Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailViewMode('code')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: '1px solid #0D9488',
                        background: emailViewMode === 'code' ? '#0D9488' : '#FFFFFF',
                        color: emailViewMode === 'code' ? '#FFFFFF' : '#0D9488',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Code size={13} /> Raw Email HTML
                    </button>
                  </div>
                </div>

                {/* Email Metadata & Customization Cards */}
                <div style={{
                  background: '#FAF8FC',
                  border: '1px solid #E9D5FF',
                  borderRadius: 16,
                  padding: '16px 20px',
                  marginBottom: 24,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#3A2E4C', marginBottom: 4 }}>
                      Subject Line:
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={emailData?.subject || ''}
                        onChange={e => handleUpdateEmailField('subject', e.target.value)}
                        placeholder="Subject Line"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #D8B4FE',
                          fontSize: 13,
                          outline: 'none',
                          background: '#FFFFFF'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (emailData?.subject) navigator.clipboard.writeText(emailData.subject);
                        }}
                        title="Copy Subject Line"
                        style={{
                          background: '#EDE9FE',
                          border: '1px solid #C4B5FD',
                          color: '#6D28D9',
                          borderRadius: 8,
                          padding: '8px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#3A2E4C', marginBottom: 4 }}>
                      Preview Text (Teaser under 90 chars):
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={emailData?.previewText || ''}
                        onChange={e => handleUpdateEmailField('previewText', e.target.value)}
                        placeholder="Preview Text"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #D8B4FE',
                          fontSize: 13,
                          outline: 'none',
                          background: '#FFFFFF'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (emailData?.previewText) navigator.clipboard.writeText(emailData.previewText);
                        }}
                        title="Copy Preview Text"
                        style={{
                          background: '#EDE9FE',
                          border: '1px solid #C4B5FD',
                          color: '#6D28D9',
                          borderRadius: 8,
                          padding: '8px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#3A2E4C', marginBottom: 4 }}>
                      Speaker Name:
                    </label>
                    <input
                      type="text"
                      value={emailData?.speakerName || ''}
                      onChange={e => handleUpdateEmailField('speakerName', e.target.value)}
                      placeholder="e.g. Simmin Bawa"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #D8B4FE',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#3A2E4C', marginBottom: 4 }}>
                      Personal Booking Link (P.S. Box):
                    </label>
                    <input
                      type="text"
                      value={emailData?.bookingUrl || ''}
                      onChange={e => handleUpdateEmailField('bookingUrl', e.target.value)}
                      placeholder="https://themysticlotus.com/booking"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #D8B4FE',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                        background: '#FFFFFF'
                      }}
                    />
                  </div>
                </div>

                {/* Attendee Testimonials / Quotes Customizer */}
                <div style={{
                  background: '#FAF5FF',
                  border: '1px solid #D8B4FE',
                  borderRadius: 14,
                  padding: '14px 18px',
                  marginBottom: 20
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#5B21B6' }}>
                      💬 Attendee Experiences / Quotes on Call ({emailData?.attendeeQuotes?.length || 0})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddQuote}
                      style={{
                        background: '#EDE9FE',
                        border: '1px solid #8B5CF6',
                        color: '#6D28D9',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Plus size={11} /> Add Quote
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(emailData?.attendeeQuotes || []).map((q, qIdx) => (
                      <div key={qIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 32px', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={q.quote}
                          onChange={e => handleQuoteChange(qIdx, 'quote', e.target.value)}
                          placeholder="Attendee quote or breakthrough..."
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid #D8B4FE',
                            fontSize: 12,
                            background: '#FFFFFF'
                          }}
                        />
                        <input
                          type="text"
                          value={q.attendeeName}
                          onChange={e => handleQuoteChange(qIdx, 'attendeeName', e.target.value)}
                          placeholder="Attendee Name"
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid #D8B4FE',
                            fontSize: 12,
                            background: '#FFFFFF'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteQuote(qIdx)}
                          style={{ background: 'none', border: 0, color: '#EF4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* VIEW MODE: RAW CODE */}
                {emailViewMode === 'code' ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: '#6B5E7D' }}>
                        Copy this responsive HTML directly into your email campaign HTML editor:
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyEmailHtml}
                        style={{
                          background: emailCopied ? '#10B981' : '#7b2ff7',
                          color: '#FFFFFF',
                          border: 0,
                          borderRadius: 8,
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        {emailCopied ? <Check size={14} /> : <Copy size={14} />}
                        {emailCopied ? 'Copied HTML!' : 'Copy Email HTML'}
                      </button>
                    </div>

                    <textarea
                      readOnly
                      value={emailHtml}
                      rows={26}
                      style={{
                        width: '100%',
                        background: '#1A1528',
                        color: '#E9D5FF',
                        padding: 18,
                        borderRadius: 14,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        lineHeight: 1.5,
                        border: 0,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ) : (
                  /* VIEW MODE: VISUAL PREVIEW MATCHING MYSTIC LOTUS EMAIL REFERENCE */
                  <div style={{
                    background: '#F0ECE9',
                    padding: '30px 16px',
                    borderRadius: 20,
                    overflow: 'auto',
                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{
                      maxWidth: 600,
                      margin: '0 auto',
                      background: '#FFFFFF',
                      borderRadius: 12,
                      padding: '40px 32px',
                      boxShadow: '0 4px 25px rgba(0,0,0,0.08)',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
                    }}>
                      {/* Logo & Header */}
                      <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, letterSpacing: 2, color: '#54B6CA', textTransform: 'uppercase' }}>
                          The Mystic Lotus &amp; Dragonflies
                        </div>
                        <div style={{ fontSize: 10, letterSpacing: 3, color: '#888888', textTransform: 'uppercase', marginTop: 4 }}>
                          Awaken &bull; Heal &bull; Transform
                        </div>
                      </div>

                      {/* Salutation */}
                      <div style={{ fontSize: 16, color: '#222222', marginBottom: 20 }}>
                        Hey <strong>First name</strong> ,
                      </div>

                      {/* Opening Hook */}
                      <div
                        style={{ fontSize: 15, color: '#333333', lineHeight: 1.7, marginBottom: 24 }}
                        dangerouslySetInnerHTML={{ __html: emailData?.hookText || `Some experiences can't be explained. They can only be felt. On our recent live call with Expert Healer-Trainer <strong>${emailData?.speakerName || 'Simmin Bawa'}</strong>, the <strong>${masterclassName}</strong> became a space of deep healing, surrender, and connection.` }}
                      />

                      {/* Participant intro */}
                      <div style={{ fontSize: 15, color: '#333333', lineHeight: 1.6, marginBottom: 14 }}>
                        Participants stepped into the energy and shared what they experienced:
                      </div>

                      {/* Attendee Quotes Box */}
                      <div style={{
                        backgroundColor: '#FAFAF9',
                        borderLeft: '3px solid #54B6CA',
                        padding: '16px 20px',
                        borderRadius: 6,
                        marginBottom: 26
                      }}>
                        {(emailData?.attendeeQuotes || []).map((q, qIdx) => (
                          <div key={qIdx} style={{ marginBottom: 14, fontSize: 14, color: '#222222', lineHeight: 1.6 }}>
                            <em>&ldquo;{q.quote}&rdquo;</em>
                            <div style={{ fontWeight: 700, color: '#333333', marginTop: 4 }}>- {q.attendeeName}</div>
                          </div>
                        ))}
                      </div>

                      {/* Video Replay Thumbnail Banner */}
                      <div style={{ textAlign: 'center', margin: '24px 0 16px' }}>
                        <div style={{
                          position: 'relative',
                          borderRadius: 12,
                          overflow: 'hidden',
                          background: 'linear-gradient(135deg, #1A1528, #3B1E63)',
                          padding: '28px 20px',
                          color: '#FFFFFF',
                          textAlign: 'center',
                          boxShadow: '0 8px 24px rgba(84,182,202,0.15)'
                        }}>
                          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#54B6CA', fontWeight: 700, marginBottom: 8 }}>
                            Masterclass Replay
                          </div>
                          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>
                            {masterclassName}
                          </div>
                          <div style={{ fontSize: 13, color: '#E9D5FF', marginBottom: 16 }}>
                            With Healer-Trainer {emailData?.speakerName || 'Simmin Bawa'}
                          </div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 50,
                            height: 50,
                            background: '#54B6CA',
                            borderRadius: '50%',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                          }}>
                            <span style={{ display: 'inline-block', width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '14px solid #ffffff', marginLeft: 3 }} />
                          </div>
                        </div>
                      </div>

                      {/* Primary CTA Button */}
                      <div style={{ textAlign: 'center', margin: '20px 0 28px' }}>
                        <a
                          href={`https://www.youtube.com/watch?v=${videoId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#54B6CA',
                            color: '#FFFFFF',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: 15,
                            padding: '13px 32px',
                            borderRadius: 50,
                            boxShadow: '0 4px 14px rgba(84,182,202,0.3)'
                          }}
                        >
                          Watch The Full Replay Here!
                        </a>
                      </div>

                      {/* Key Moments Intro */}
                      <div style={{ fontSize: 15, color: '#333333', lineHeight: 1.7, margin: '24px 0 20px' }}>
                        There are moments on a live call that you may want to go back to: a message from a higher energy, a moment of healing, or an experience that feels deeply personal. We&apos;ve gathered the key moments below so you can return to them anytime.
                      </div>

                      {/* Key Moments Timestamps List with Emojis */}
                      <div style={{ marginBottom: 24 }}>
                        {(emailData?.keyMoments || []).map((m, mIdx) => (
                          <div key={mIdx} style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#111111', lineHeight: 1.4 }}>
                              {m.formattedTime} - {m.title} {m.emoji || '✨'}
                            </div>
                            <div style={{ fontSize: 14, color: '#555555', marginTop: 3, lineHeight: 1.5 }}>
                              {m.description}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Secondary CTA Button */}
                      <div style={{ textAlign: 'center', margin: '20px 0 30px' }}>
                        <a
                          href={`https://www.youtube.com/watch?v=${videoId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#54B6CA',
                            color: '#FFFFFF',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: 15,
                            padding: '13px 32px',
                            borderRadius: 50,
                            boxShadow: '0 4px 14px rgba(84,182,202,0.3)'
                          }}
                        >
                          Watch The Full Replay Here!
                        </a>
                      </div>

                      {/* P.S. Booking Callout Box */}
                      <div style={{
                        backgroundColor: '#FBF3EE',
                        borderRadius: 12,
                        padding: '20px 22px',
                        margin: '28px 0',
                        border: '1px solid #F3E4D8'
                      }}>
                        <div style={{ fontSize: 14, color: '#2D1B4E', lineHeight: 1.6, marginBottom: 12 }}>
                          <strong>P.S.</strong> Missed the Live call? Don&apos;t worry, the energies will still work for you for one time. It might be exactly what you need.
                        </div>
                        <div style={{ fontSize: 14, color: '#4A3A60', lineHeight: 1.5 }}>
                          Want to connect with your loved one or guide, book a personal session or learn the method:
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 14 }}>
                          <a
                            href={emailData?.bookingUrl || 'https://themysticlotus.com/booking'}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#54B6CA',
                              color: '#FFFFFF',
                              textDecoration: 'none',
                              fontWeight: 700,
                              fontSize: 14,
                              padding: '11px 26px',
                              borderRadius: 50
                            }}
                          >
                            Book A Session!
                          </a>
                        </div>
                      </div>

                      {/* Contact & Support Section */}
                      <div style={{ fontSize: 14, color: '#444444', lineHeight: 1.7, margin: '24px 0' }}>
                        <p style={{ margin: '0 0 8px', fontWeight: 600 }}>If you have any questions or need help, reply to this email or get in touch with our team:</p>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          <li style={{ marginBottom: 4 }}>
                            WhatsApp &ndash; please{' '}
                            <a
                              href="https://wa.me/919109004333"
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#54B6CA', fontWeight: 600, textDecoration: 'underline' }}
                            >
                              click here to WhatsApp us
                            </a>
                          </li>
                          <li style={{ marginBottom: 4 }}>Phone &ndash; <strong>+919109004333</strong></li>
                          <li>Email &ndash; <span style={{ color: '#54B6CA' }}>help@themysticlotus.com</span></li>
                        </ul>
                      </div>

                      {/* Sign-Off */}
                      <div style={{ fontSize: 15, color: '#222222', marginTop: 28, lineHeight: 1.6 }}>
                        <div>In Healing &amp; Growth,</div>
                        <div style={{ fontWeight: 700, color: '#54B6CA', marginTop: 4 }}>The Mystic Lotus &amp; Dragonflies Team</div>
                      </div>

                      <hr style={{ border: 0, borderTop: '1px solid #EEEEEE', margin: '32px 0 20px' }} />

                      {/* Footer */}
                      <div style={{ textAlign: 'center', fontSize: 11, color: '#888888', lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 700, color: '#555555', marginBottom: 4 }}>
                          THE MYSTIC LOTUS &amp; DRAGONFLIES
                        </div>
                        <div style={{ fontSize: 10, color: '#999999', marginBottom: 10 }}>
                          DISCLAIMER: Healing and energy practices are complementary therapies and are not intended to replace professional medical or psychiatric advice.
                        </div>
                        <div style={{ color: '#54B6CA', textDecoration: 'underline', marginBottom: 6 }}>
                          Click here to Unsubscribe
                        </div>
                        <div>
                          The Mystic Lotus &amp; Dragonflies, Mumbai, Maharashtra 400052, India
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: WORDPRESS HTML CODE */}
            {activeTab === 'code' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: '#6B5E7D' }}>
                    Ready to publish! Paste this into a <strong>Custom HTML</strong> block in your WordPress page:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      background: copied ? '#10B981' : '#7b2ff7',
                      color: '#FFFFFF',
                      border: 0,
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied to Clipboard!' : 'Copy WordPress Code'}
                  </button>
                </div>

                <textarea
                  readOnly
                  value={wordpressHtml}
                  rows={26}
                  style={{
                    width: '100%',
                    background: '#1A1528',
                    color: '#E9D5FF',
                    padding: 18,
                    borderRadius: 14,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: 1.5,
                    border: 0,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
