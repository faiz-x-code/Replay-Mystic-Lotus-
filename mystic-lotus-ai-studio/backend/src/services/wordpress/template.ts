export interface WordPressTemplateOptions {
  videoId: string;
  tag: string;
  heading: string;
  subheading: string;
  playerNumber?: number | string;
  timestamps: Array<{
    title: string;
    seconds: number;
    formattedTime: string;
  }>;
}

export function extractYouTubeId(url: string): string {
  if (!url) return '';
  const clean = url.trim();
  if (/^[\w-]{11}$/.test(clean)) return clean;
  const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|live\/|shorts\/|watch\?.*v=))([\w-]{11})/i);
  if (match) return match[1];
  const vMatch = clean.match(/[?&]v=([\w-]{11})/);
  if (vMatch) return vMatch[1];
  const liveMatch = clean.match(/\/live\/([\w-]{11})/);
  if (liveMatch) return liveMatch[1];
  return clean;
}


export function generateWordPressEmbedCode(options: WordPressTemplateOptions): string {
  const { videoId, tag, heading, subheading, timestamps } = options;
  const pNum = options.playerNumber !== undefined && options.playerNumber !== null && String(options.playerNumber).trim() !== ''
    ? String(options.playerNumber).trim()
    : '1';

  const timestampListHtml = timestamps.map(t => `        <li>
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
        ${tag}
      </div>

      <h2 class="ml-video-heading">
        ${heading}
      </h2>

      <p class="ml-video-subheading">
        ${subheading}
      </p>

      <!-- TIMESTAMPS -->
      <ul class="ml-timestamps">

${timestampListHtml}

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

        videoId: '${videoId}',

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
