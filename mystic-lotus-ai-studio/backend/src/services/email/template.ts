export interface EmailQuote {
  quote: string;
  attendeeName: string;
}

export interface EmailMoment {
  formattedTime: string;
  title: string;
  emoji?: string;
  description: string;
}

export interface ReplayEmailData {
  masterclassName: string;
  speakerName?: string;
  videoId: string;
  replayUrl?: string;
  bookingUrl?: string;
  subject?: string;
  previewText?: string;
  hookText?: string;
  attendeeQuotes?: EmailQuote[];
  keyMoments?: EmailMoment[];
  whatsappNumber?: string;
  supportEmail?: string;
  supportPhone?: string;
}

/**
 * Generate responsive, email-client-ready HTML matching
 * The Mystic Lotus & Dragonflies masterclass email reference.
 */
export function generateReplayEmailHtml(data: ReplayEmailData): string {
  const masterclass = data.masterclassName || 'Masterclass Replay';
  const speaker = data.speakerName || 'Simmin Bawa';
  const vId = data.videoId || 'OLXSmAhpU-g';
  const replayLink = data.replayUrl || `https://www.youtube.com/watch?v=${vId}`;
  const bookingLink = data.bookingUrl || 'https://themysticlotus.com/booking';
  const whatsappNum = data.whatsappNumber || '+919109004333';
  const supportMail = data.supportEmail || 'help@themysticlotus.com';
  const supportPhoneNum = data.supportPhone || '+919109004333';

  const defaultQuotes: EmailQuote[] = [
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
  ];

  const quotes = (data.attendeeQuotes && data.attendeeQuotes.length > 0)
    ? data.attendeeQuotes
    : defaultQuotes;

  const defaultMoments: EmailMoment[] = [
    {
      formattedTime: '1:37',
      title: 'A Simple Way to Connect With Mother Earth',
      emoji: '🌏',
      description: `Discover how to connect with Mother Earth through ${speaker}'s energies.`
    },
    {
      formattedTime: '8:41',
      title: 'A Personal Channeling Session With Lord Buddha',
      emoji: '🌸',
      description: 'Watch a powerful personal channeling unfold.'
    },
    {
      formattedTime: '42:44',
      title: 'Healing for Pain: Join This Group Healing Even Now',
      emoji: '✨',
      description: 'Missed the live session? You can still experience this channeled healing.'
    },
    {
      formattedTime: '1:50:48',
      title: '"She Heard From Her Son... After He Passed Away."',
      emoji: '🕊️',
      description: 'Watch Deepti Gupta receive a connection with her son who has passed away.'
    },
    {
      formattedTime: '2:04:07',
      title: 'He Connects With His Deceased Mother',
      emoji: '💫',
      description: "Watch Rahul Pujaray's emotional experience of connecting with his mother."
    }
  ];

  const moments = (data.keyMoments && data.keyMoments.length > 0)
    ? data.keyMoments
    : defaultMoments;

  const hook = data.hookText || `Some experiences can't be explained. They can only be felt. On our recent live call with Expert Healer-Trainer <strong>${speaker}</strong>, the <strong>${masterclass}</strong> became a space of deep healing, surrender, and connection.`;

  const quotesHtml = quotes.map(q => `
    <div style="margin-bottom: 16px; line-height: 1.6; font-size: 15px; color: #222222;">
      <em>&ldquo;${q.quote}&rdquo;</em>
      <div style="font-weight: 700; color: #333333; margin-top: 4px;">- ${q.attendeeName}</div>
    </div>
  `).join('');

  const momentsHtml = moments.map(m => `
    <div style="margin-bottom: 22px;">
      <div style="font-size: 15px; font-weight: 700; color: #111111; line-height: 1.4;">
        ${m.formattedTime} - ${m.title} ${m.emoji || ''}
      </div>
      <div style="font-size: 14px; color: #555555; margin-top: 3px; line-height: 1.5;">
        ${m.description}
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.subject || `${masterclass} Replay`}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f7f7f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    .email-wrapper { width: 100%; background-color: #f7f7f7; padding: 30px 10px; }
    .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; padding: 40px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
    .cta-button { display: inline-block; background-color: #54B6CA; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 34px; border-radius: 50px; text-align: center; margin: 24px 0; }
    .cta-button:hover { background-color: #429cae; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">

      <!-- HEADER / LOGO -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-family: Georgia, serif; font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #54B6CA; text-transform: uppercase;">
          The Mystic Lotus &amp; Dragonflies
        </div>
        <div style="font-size: 11px; letter-spacing: 3px; color: #888888; text-transform: uppercase; margin-top: 4px;">
          Awaken &bull; Heal &bull; Transform
        </div>
      </div>

      <!-- SALUTATION -->
      <div style="font-size: 16px; color: #222222; margin-bottom: 20px;">
        Hey <strong>{{ First name }}</strong> ,
      </div>

      <!-- OPENING HOOK -->
      <div style="font-size: 15px; color: #333333; line-height: 1.7; margin-bottom: 24px;">
        ${hook}
      </div>

      <!-- PARTICIPANTS INTRO -->
      <div style="font-size: 15px; color: #333333; line-height: 1.6; margin-bottom: 16px;">
        Participants stepped into the energy and shared what they experienced:
      </div>

      <!-- PARTICIPANT QUOTES -->
      <div style="background-color: #FAFAF9; border-left: 3px solid #54B6CA; padding: 16px 20px; border-radius: 6px; margin-bottom: 30px;">
        ${quotesHtml}
      </div>

      <!-- VIDEO BANNER / THUMBNAIL PREVIEW -->
      <div style="text-align: center; margin: 24px 0 16px;">
        <a href="${replayLink}" target="_blank" style="text-decoration: none; display: block;">
          <div style="position: relative; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg, #1A1528, #3B1E63); padding: 30px 20px; color: #ffffff; text-align: center; box-shadow: 0 8px 24px rgba(84,182,202,0.15);">
            <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #54B6CA; font-weight: 700; margin-bottom: 8px;">
              Masterclass Replay
            </div>
            <div style="font-family: Georgia, serif; font-size: 22px; font-weight: 700; line-height: 1.3; margin-bottom: 8px;">
              ${masterclass}
            </div>
            <div style="font-size: 14px; color: #E9D5FF; margin-bottom: 18px;">
              With Healer-Trainer ${speaker}
            </div>
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: rgba(84,182,202,0.9); border-radius: 50%; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
              <span style="display: inline-block; width: 0; height: 0; border-top: 10px solid transparent; border-bottom: 10px solid transparent; border-left: 16px solid #ffffff; margin-left: 4px;"></span>
            </div>
          </div>
        </a>
      </div>

      <!-- PRIMARY CTA BUTTON -->
      <div style="text-align: center;">
        <a href="${replayLink}" target="_blank" class="cta-button">
          Watch The Full Replay Here!
        </a>
      </div>

      <!-- KEY MOMENTS INTRO -->
      <div style="font-size: 15px; color: #333333; line-height: 1.7; margin: 30px 0 24px;">
        There are moments on a live call that you may want to go back to: a message from a higher energy, a moment of healing, or an experience that feels deeply personal. We've gathered the key moments below so you can return to them anytime.
      </div>

      <!-- TIMESTAMPS / KEY MOMENTS LIST -->
      <div style="margin-bottom: 24px;">
        ${momentsHtml}
      </div>

      <!-- SECONDARY CTA BUTTON -->
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${replayLink}" target="_blank" class="cta-button">
          Watch The Full Replay Here!
        </a>
      </div>

      <!-- P.S. CALLOUT BOX -->
      <div style="background-color: #FBF3EE; border-radius: 12px; padding: 22px 24px; margin: 30px 0; border: 1px solid #F3E4D8;">
        <div style="font-size: 15px; color: #2D1B4E; line-height: 1.6; margin-bottom: 14px;">
          <strong>P.S.</strong> Missed the Live call? Don't worry, the energies will still work for you for one time. It might be exactly what you need.
        </div>
        <div style="font-size: 14px; color: #4A3A60; line-height: 1.5;">
          Want to connect with your loved one or guide, book a personal session or learn the method:
        </div>
        <div style="text-align: center; margin-top: 16px;">
          <a href="${bookingLink}" target="_blank" class="cta-button" style="padding: 12px 28px; font-size: 15px; margin: 0;">
            Book A Session!
          </a>
        </div>
      </div>

      <!-- SUPPORT / CONTACT SECTION -->
      <div style="font-size: 14px; color: #444444; line-height: 1.7; margin: 28px 0;">
        <p style="margin: 0 0 10px; font-weight: 600;">If you have any questions or need help, reply to this email or get in touch with our team:</p>
        <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
          <li style="margin-bottom: 6px;">WhatsApp &ndash; please <a href="https://wa.me/${whatsappNum.replace(/[^0-9]/g, '')}" target="_blank" style="color: #54B6CA; font-weight: 600; text-decoration: underline;">click here to WhatsApp us</a></li>
          <li style="margin-bottom: 6px;">Phone &ndash; <strong>${supportPhoneNum}</strong></li>
          <li>Email &ndash; <a href="mailto:${supportMail}" style="color: #54B6CA; text-decoration: none;">${supportMail}</a></li>
        </ul>
      </div>

      <!-- SIGN-OFF -->
      <div style="font-size: 15px; color: #222222; margin-top: 30px; line-height: 1.6;">
        <div>In Healing &amp; Growth,</div>
        <div style="font-weight: 700; color: #54B6CA; margin-top: 4px;">The Mystic Lotus &amp; Dragonflies Team</div>
      </div>

      <hr style="border: 0; border-top: 1px solid #EEEEEE; margin: 36px 0 24px;">

      <!-- FOOTER -->
      <div style="text-align: center; font-size: 11px; color: #888888; line-height: 1.6;">
        <div style="font-weight: 700; color: #555555; margin-bottom: 6px;">
          THE MYSTIC LOTUS &amp; DRAGONFLIES
        </div>
        <div style="margin-bottom: 12px; font-size: 10px; color: #999999; max-width: 500px; margin-left: auto; margin-right: auto;">
          DISCLAIMER: Healing and energy practices are complementary therapies and are not intended to replace professional medical or psychiatric advice.
        </div>
        <div style="margin-bottom: 8px;">
          <a href="#" style="color: #54B6CA; text-decoration: underline;">Click here to Unsubscribe</a>
        </div>
        <div>
          The Mystic Lotus &amp; Dragonflies, Mumbai, Maharashtra 400052, India
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;
}
