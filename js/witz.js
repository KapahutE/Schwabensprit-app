// Schwabensprit – „Witz vom Dag“: Hannes & Lena, kurze schwäbische Dialog-Witze an der Tankstelle.
// Eigene, frei erfundene Figuren (halbrealistischer Vektorstil, Farben über --d-* in app.css).
// Der Dialog läuft Zeile für Zeile ab, sobald die Karte ins Bild kommt; die Pointe kommt zum Schluss.
// Alle Teile sind klassische Skripte und teilen sich den globalen Gültigkeitsbereich – Reihenfolge in index.html beachten.

const Witz = (() => {
  const FONT = 'font-family="-apple-system,BlinkMacSystemFont,\'SF Pro Text\',system-ui,sans-serif"';
  let UID = 0;

  function defs(u, night) {
    const lg = (id, a, b, x2 = 1, y2 = 0) => `<linearGradient id="${id}${u}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="var(${a})"/><stop offset="1" stop-color="var(${b})"/></linearGradient>`;
    return `<defs>
      ${lg("sky", night ? "--d-nsky1" : "--d-sky1", night ? "--d-nsky2" : "--d-sky2", 0, 1)}
      ${lg("asph", night ? "--d-nasph1" : "--d-asph1", night ? "--d-nasph2" : "--d-asph2", 0, 1)}
      ${lg("skin", "--d-skin2", "--d-skin")}${lg("hairA", "--d-hairA2", "--d-hairA")}${lg("hairB", "--d-hairB2", "--d-hairB")}
      ${lg("vest", "--d-vest2", "--d-vest")}${lg("jack", "--d-jack2", "--d-jack")}${lg("tee", "--d-tee2", "--d-tee")}
      ${lg("jeansA", "--d-jeansA2", "--d-jeansA")}${lg("jeansB", "--d-jeansB2", "--d-jeansB")}
      ${lg("pump", "--d-pump1", "--d-pump2")}${lg("car", "--d-car1", "--d-car2", 0, 1)}${lg("glass", "--d-glass1", "--d-glass2", 1, 1)}
      <radialGradient id="glow${u}"><stop offset="0" stop-color="var(--d-glow)" stop-opacity=".6"/><stop offset="1" stop-color="var(--d-glow)" stop-opacity="0"/></radialGradient>
      <clipPath id="clip${u}"><rect width="240" height="180" rx="14"/></clipPath></defs>`;
  }
  // ---------- Kulisse ----------
  function stage(u, night = false, roof = true) {
    return `<g clip-path="url(#clip${u})"><rect width="240" height="180" fill="url(#sky${u})"/>
      <path d="M0 118 Q30 104 64 112 Q100 98 140 108 Q180 96 240 106 V150 H0Z" fill="var(${night ? "--d-nhill2" : "--d-hill2"})"/>
      <path d="M0 132 Q50 120 100 128 Q160 118 240 128 V150 H0Z" fill="var(${night ? "--d-nhill" : "--d-hill"})"/>
      <rect y="146" width="240" height="34" fill="url(#asph${u})"/>
      <path d="M0 146 H240" stroke="var(--d-curb)" stroke-width="2"/>
      <path d="M20 162 h26 M86 162 h26 M152 162 h26 M218 162 h26" stroke="var(--d-lane)" stroke-width="1.6" opacity=".7"/>
      ${roof ? `<rect x="-5" y="0" width="250" height="13" fill="var(--d-gold)"/><rect x="-5" y="11" width="250" height="5" fill="var(--d-canopy)"/>
        ${[24, 84, 144, 204].map((x) => `<rect x="${x}" y="16" width="16" height="2" rx="1" fill="var(--d-light)"/>`).join("")}` : ""}`;
  }
  const END = `</g>`;
  const shadow = (cx, rx, cy = 173) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="3.4" fill="var(--d-shadow)"/>`;
  function pump(u, x, price, tone = "gold", base = 160) {
    return `<g transform="translate(${x} ${base - 64})">${shadow(17, 26, 64)}
      <rect x="-4" y="55" width="42" height="9" rx="2" fill="var(--d-plinth)"/>
      <rect x="0" y="0" width="34" height="58" rx="4" fill="url(#pump${u})"/>
      <rect x="0" y="0" width="34" height="8" rx="3" fill="var(--d-gold)"/>
      <text x="17" y="6.2" text-anchor="middle" font-size="4.6" font-weight="700" fill="var(--d-on-gold)" ${FONT}>SUPER E5</text>
      <rect x="5" y="12" width="24" height="14" rx="2" fill="var(--d-screen)"/><rect x="5" y="12" width="24" height="5" rx="2" fill="#fff" opacity=".06"/>
      <text x="17" y="22.4" text-anchor="middle" font-size="7.4" font-weight="800" fill="var(--d-${tone})" ${FONT}>${price} €</text>
      <rect x="8" y="31" width="18" height="2.4" rx="1.2" fill="var(--d-pumpline)"/><rect x="8" y="36" width="18" height="2.4" rx="1.2" fill="var(--d-pumpline)"/>
      <rect x="31" y="10" width="6" height="20" rx="2" fill="var(--d-pump2)"/><path d="M34 14 v-3 h4 l2 3z" fill="var(--d-gold2)"/></g>`;
  }
  function car(u, x, flip = false, sc = 1.15, base = 172) {
    return `<g transform="translate(${x} ${base}) scale(${flip ? -sc : sc} ${sc})">${shadow(0, 46, 1)}
      <path d="M-48 -12 Q-49 -24 -38 -27 L-24 -30 Q-14 -45 6 -46 Q26 -46 35 -31 L45 -28 Q52 -26 52 -17 L52 -12 Q52 -6 46 -6 H-43 Q-48 -6 -48 -12Z" fill="url(#car${u})"/>
      <path d="M-17 -31 Q-10 -42 4 -42.5 L4 -31Z" fill="url(#glass${u})"/><path d="M8 -42.5 Q22 -42 29 -31 L8 -31Z" fill="url(#glass${u})"/>
      <path d="M-12 -40 L-4 -32" stroke="#fff" stroke-width="1.4" opacity=".35"/><path d="M6 -31 V-9" stroke="var(--d-car2)" stroke-width="1.1"/>
      <path d="M-42 -21 Q0 -24 48 -21" stroke="#fff" stroke-width="1.1" opacity=".25" fill="none"/>
      <rect x="45" y="-24" width="7" height="4" rx="1.6" fill="var(--d-lamp)"/><rect x="-49" y="-23" width="4.5" height="3.4" rx="1.3" fill="var(--d-hi)"/>
      <rect x="12" y="-26" width="7" height="1.8" rx=".9" fill="var(--d-car2)"/><rect x="-34" y="-25" width="6" height="5" rx="1.2" fill="var(--d-car2)" opacity=".8"/>
      ${[-29, 31].map((cx) => `<circle cx="${cx}" cy="-8" r="9.5" fill="var(--d-tyre)"/><circle cx="${cx}" cy="-8" r="5.4" fill="var(--d-rim)"/><circle cx="${cx}" cy="-8" r="5.4" fill="none" stroke="var(--d-tyre)" stroke-width="1" stroke-dasharray="2 2.2"/><circle cx="${cx}" cy="-8" r="1.6" fill="var(--d-tyre)"/>`).join("")}</g>`;
  }
  // ---------- Figuren (Ursprung zwischen den Füßen, schaut nach rechts; Höhe ≈ 150) ----------
  function shoe(x, y, rot = 0) {
    return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-8 -1 Q-8 -7 -1.5 -7 L5 -7 Q10 -6.5 12 -2.4 L12.4 0 Q12.4 1.8 10.6 1.8 H-6.4 Q-8.4 1.8 -8 -1Z" fill="var(--d-shoe)"/>
      <path d="M-8 .9 H12.4" stroke="var(--d-sole)" stroke-width="2" stroke-linecap="round"/><path d="M0 -4.6 l5.5 -.5" stroke="var(--d-shoeacc)" stroke-width="1.3" stroke-linecap="round"/></g>`;
  }
  function limb(u, [x1, y1, x2, y2, x3, y3], sleeve, far) {
    return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${sleeve}" stroke-width="8" stroke-linecap="round"/><path d="M${x2} ${y2} L${x3} ${y3}" stroke="${sleeve}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="${x2}" cy="${y2}" r="3.6" fill="${sleeve}"/><ellipse cx="${x3 + (x3 - x2) * .12}" cy="${y3 + (y3 - y2) * .12}" rx="3.7" ry="4.2" fill="url(#skin${u})"${far ? ' opacity=".9"' : ""}/>`;
  }
  function person(u, { who = "A", x, y = 172, s = 0.6, flip = false, lean = 0, near = null, far = null, legs = null, face = "smile", extra = "", hold = "", pj = false, shades = false }) {
    const A = who === "A";
    const sleeve = A ? `url(#tee${u})` : pj ? "var(--d-pj)" : `url(#jack${u})`, jeans = A ? `url(#jeansA${u})` : pj ? "var(--d-pj)" : `url(#jeansB${u})`;
    near ||= [11, -117, 15, -96, 14, -80]; far ||= [-10, -117, -14, -96, -13, -80];
    const legSvg = legs
      ? legs.map((l, i) => `<path d="M${l[0]} ${l[1]} L${l[2]} ${l[3]} L${l[4]} ${l[5]}" stroke="${jeans}" stroke-width="${i ? 9 : 9}" stroke-linecap="round" stroke-linejoin="round" fill="none"${i ? "" : ' opacity=".92"'}/>${shoe(l[4], l[5] + 3, l[6] || 0)}`).join("")
      : `<path d="M-11 -78 L-9.5 -40 L-8.5 -6 H-1.6 L-1 -40 L-.5 -78Z" fill="${jeans}" opacity=".92"/><path d="M.8 -78 L1.6 -40 L2.6 -6 H9.6 L10 -40 L11.5 -78Z" fill="${jeans}"/>
         <path d="M5 -44 q1.5 2 .5 4" stroke="var(--d-fold)" stroke-width=".8" fill="none"/>${shoe(-5, -1)}${shoe(6.5, -1)}`;
    const top = A
      ? `<path d="M-12 -121 C-6 -124 6 -124 12 -121 L14 -100 L12 -80 H-12 L-14 -100Z" fill="url(#tee${u})"/>
         <path d="M-13.5 -119.5 L-3 -123 L-3 -79 H-13 C-15.5 -93 -15.8 -108 -13.5 -119.5Z" fill="url(#vest${u})"/>
         <path d="M13.5 -119.5 L3 -123 L3 -79 H13 C15.5 -93 15.8 -108 13.5 -119.5Z" fill="url(#vest${u})"/>
         <g stroke="var(--d-vestline)" stroke-width=".9" opacity=".75">${[-111, -103, -95, -87].map((yy) => `<path d="M-14.6 ${yy} H-3.2 M14.6 ${yy} H3.2"/>`).join("")}</g>
         <path d="M-7 -124 Q0 -127 7 -124 L7.6 -119.5 Q0 -122 -7.6 -119.5Z" fill="var(--d-vest2)"/><path d="M5 -96 h7" stroke="var(--d-vestline)" stroke-width="1.4" stroke-linecap="round"/>`
      : pj
      ? `<path d="M-11.5 -121 C-6 -124 6 -124 11.5 -121 L13.5 -100 L12 -78 H-12 L-13.5 -100Z" fill="var(--d-pj)"/><path d="M-12 -108 H13 M-13 -96 H13.5 M-12.5 -84 H12.5" stroke="var(--d-pj2)" stroke-width="2.6" opacity=".7"/>`
      : `<path d="M-11.5 -121 C-6 -124 6 -124 11.5 -121 L13.5 -100 L12 -79 H-12 L-13.5 -100Z" fill="url(#tee${u})"/>
         <path d="M-13 -119.5 L-4 -123 L-2.5 -100 L-4 -76 H-13.5 C-15.5 -92 -15.5 -108 -13 -119.5Z" fill="url(#jack${u})"/>
         <path d="M13 -119.5 L4 -123 L2.5 -100 L4 -76 H13.5 C15.5 -92 15.5 -108 13 -119.5Z" fill="url(#jack${u})"/>
         <path d="M-4 -123 L-1 -113 L-6 -116Z M4 -123 L1 -113 L6 -116Z" fill="var(--d-jack2)"/><path d="M-12.5 -86 H-4.5 M12.5 -86 H4.5" stroke="var(--d-jack2)" stroke-width="1.2"/>`;
    const hair = A
      ? `<path d="M-9.4 -140 C-11.5 -154 -.5 -161 10 -158 C16.5 -156 18.6 -150.5 17.4 -146 C14 -148.5 9 -148.5 5 -147.4 C2 -146.4 -1 -144.5 -3.2 -141.5 C-5 -139 -7 -137.2 -9.4 -140Z" fill="url(#hairA${u})"/>
         <path d="M0 -156 Q9 -159 15.5 -151" stroke="var(--d-hairA2)" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".6"/>`
      : `<path d="M-11 -136 C-13 -153 -2 -161 9 -158 C16.5 -156 18 -150 17.6 -145 C14 -148 9 -148.6 4 -147.2 C0 -146 -3 -143 -5 -139 C-6.5 -136 -8 -132 -11 -136Z" fill="url(#hairB${u})"/>
         <path d="M-10 -146 C-20 -146 -22 -134 -19 -122 C-17 -116 -14 -116 -13 -120 C-15 -128 -14 -136 -9 -140Z" fill="url(#hairB${u})"/>
         <circle cx="-10" cy="-145" r="2.2" fill="var(--d-jack)"/>`;
    const eyes = shades
      ? `<path d="M6.5 -142.4 H15 Q15.8 -142.4 15.6 -141.4 Q15 -137.8 11.5 -137.8 Q8 -137.8 6.6 -140.8Z" fill="var(--d-ink)"/><path d="M-2.4 -141.6 H6.6" stroke="var(--d-ink)" stroke-width="1.1"/>`
      : `<path d="M7.6 -143.6 Q10 -145 13 -143.9" stroke="${A ? "var(--d-hairA)" : "var(--d-hairB)"}" stroke-width="1.15" fill="none" stroke-linecap="round"/>
         <ellipse cx="10.6" cy="-140.2" rx="1.75" ry="1.15" fill="#fff"/><circle cx="11.1" cy="-140.2" r=".95" fill="var(--d-iris${who})"/><circle cx="11.4" cy="-140.5" r=".3" fill="#fff"/>
         ${A ? "" : `<path d="M8.8 -141.4 Q10.6 -142.2 12.6 -141.4" stroke="var(--d-ink)" stroke-width=".8" fill="none"/>`}`;
    const mouth = face === "open"
      ? `<path d="M9.6 -131.6 Q12 -128 14.2 -131.6 Q12 -130.6 9.6 -131.6Z" fill="var(--d-mouth)"/>`
      : face === "yawn" ? `<ellipse cx="12" cy="-130.4" rx="1.8" ry="2.4" fill="var(--d-mouth)"/>`
      : face === "frown" ? `<path d="M10 -130.3 Q12 -131.6 14 -130.6" stroke="var(--d-lip)" stroke-width="1.1" fill="none" stroke-linecap="round"/>`
      : `<path d="M9.8 -131.4 Q12.2 -129.6 14.2 -131.6" stroke="var(--d-lip)" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    return `<g transform="translate(${x} ${y}) rotate(${lean}) scale(${flip ? -s : s} ${s})">
      ${legSvg}
      <path d="M-12 -82 H12 L12.4 -73 H-12.4Z" fill="${jeans}"/>${A ? `<path d="M-12 -80.5 H12" stroke="var(--d-belt)" stroke-width="2"/>` : ""}
      ${limb(u, far, sleeve, true)}
      ${top}
      <path d="M-3.2 -130 L-3.4 -121.5 Q1 -119.6 5.2 -121.5 L5 -128.6Z" fill="var(--d-skin2)"/>
      <path d="M-8.4 -140 C-8.4 -152.5 2 -157.4 10.4 -152.4 C15.4 -149.4 15.6 -142.6 15.1 -138.6 L16.8 -134.2 L15.1 -133.4 C15.2 -129.4 13.6 -127.2 10.6 -126.6 C7.4 -126 3.6 -127.2 .4 -129.2 C-3.8 -131.4 -8.4 -134.4 -8.4 -140Z" fill="url(#skin${u})"/>
      <ellipse cx="-3.8" cy="-139" rx="2.3" ry="3.3" fill="var(--d-skin2)"/><path d="M-4.4 -140.4 q1 1.2 0 2.6" stroke="var(--d-skin3)" stroke-width=".7" fill="none"/>
      ${hair}${eyes}
      <path d="M14.6 -140.6 L16.6 -134.6 L14.4 -134.1" stroke="var(--d-skin3)" stroke-width=".9" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      <ellipse cx="9" cy="-134.6" rx="2.4" ry="1.4" fill="var(--d-blush)" opacity="${A ? ".18" : ".32"}"/>
      ${mouth}${A ? "" : `<path d="M9.8 -131.4 Q12.2 -132.4 14.2 -131.6" stroke="var(--d-lip)" stroke-width=".6" fill="none" opacity=".6"/>`}
      ${extra}${hold}
      ${limb(u, near, sleeve, false)}</g>`;
  }
  // ---------- Witze: Szene + Dialog (wer, Text). Die letzte Zeile ist die Pointe. ----------
  const PIG = (x, y) => `<g transform="translate(${x} ${y})">${shadow(0, 20, 17)}<g fill="var(--d-gold2)"><rect x="-12" y="6" width="5.5" height="10" rx="2.4"/><rect x="6.5" y="6" width="5.5" height="10" rx="2.4"/></g>
    <ellipse cx="0" cy="0" rx="20" ry="13.5" fill="var(--d-gold)"/><ellipse cx="-4" cy="-5" rx="12" ry="4.5" fill="#fff" opacity=".25"/><path d="M-11 -10 L-8 -19 L-2 -12Z" fill="var(--d-gold2)"/>
    <ellipse cx="19" cy="1" rx="4.6" ry="5.6" fill="var(--d-gold2)"/><circle cx="17.8" cy="0" r=".8" fill="var(--d-ink)"/><circle cx="20.3" cy="0" r=".8" fill="var(--d-ink)"/><circle cx="11" cy="-4" r="1.6" fill="var(--d-ink)"/>
    <rect x="-5.5" y="-14" width="11" height="2.6" rx="1.3" fill="var(--d-ink)"/></g>`;
  const WITZE = {
    tropfa: { t: "Dr letschde Tropfa",
      svg: (u) => `${stage(u)}${pump(u, 4, "2,03")}${car(u, 140, false, 1.15, 162)}
        <path d="M38 108 Q44 150 64 152 Q78 152 84 136" stroke="var(--d-hose)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        ${shadow(66, 9)}${person(u, { who: "A", x: 66, near: [11, -117, 20, -102, 30, -92], far: [-10, -117, -2, -100, 14, -92],
          hold: `<g transform="translate(30 -92) rotate(20)"><path d="M-1 -3 H12 L16 1.5 H10.5 L8.5 -.5 H-1Z" fill="var(--d-gold)"/><rect x="-7" y="-3.5" width="8" height="10" rx="2" fill="var(--d-ink)"/></g>` })}
        <path d="M92 124 l4 -5 M95 130 l6 -2 M88 120 l1 -6" stroke="var(--d-motion)" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M93 140 q-1.8 3.8 0 5.4 q1.8 -1.6 0 -5.4z" fill="var(--d-drop)"/>
        ${shadow(206, 9)}${person(u, { who: "B", x: 206, flip: true, face: "frown", near: [11, -117, 18, -100, 8, -86], far: [-10, -117, -16, -100, -8, -86] })}${END}`,
      lines: [["B", "Hannes, dr Tank isch doch scho lang voll!"], ["A", "Dr Tank scho. Aber dr Schlauch no net."], ["B", "Ond?"], ["A", "Bezahlt isch bezahlt – dr letschde Tropfa ghört mir!"]] },
    schieba: { t: "Schieba spart",
      svg: (u) => `${stage(u, false, false)}
        <g transform="translate(220 94)"><rect x="-2" y="24" width="4" height="54" fill="var(--d-pillar)"/><rect x="-20" y="0" width="40" height="26" rx="5" fill="var(--d-sign)"/>
          <text x="0" y="10" text-anchor="middle" font-size="7" font-weight="600" fill="#fff" opacity=".9" ${FONT}>in 4 km</text><text x="0" y="21" text-anchor="middle" font-size="10" font-weight="800" fill="#fff" ${FONT}>2,25 →</text></g>
        ${car(u, 128)}
        ${shadow(52, 10)}${person(u, { who: "A", x: 52, lean: 20, face: "open", near: [11, -117, 24, -112, 34, -104], far: [-10, -117, 6, -114, 26, -108],
          legs: [[-5, -76, -14, -40, -26, -4, -14], [5, -76, 6, -40, 8, -4, 0]] })}
        ${shadow(184, 9)}${person(u, { who: "B", x: 184, flip: true, near: [11, -117, 17, -98, 16, -82], far: [-10, -117, -14, -98, -12, -82] })}${END}`,
      lines: [["B", "Hannes, warum schiebsch du dei Auto?"], ["A", "Vier Kilometer weiter isch dr Sprit vier Cent billiger."], ["B", "Ond do schiebsch na?"], ["A", "Klar – den Sprit dafür spar i mir au no!"]] },
    zwoelfe: { t: "Kurz vor zwölfe",
      svg: (u) => `${stage(u)}
        <g transform="translate(36 60)"><rect x="-2.5" y="24" width="5" height="88" fill="var(--d-pillar)"/><rect x="-28" y="0" width="56" height="26" rx="5" fill="var(--d-ink)" stroke="var(--d-pillar)" stroke-width=".8"/>
          <text x="0" y="19" text-anchor="middle" font-size="16" font-weight="800" fill="var(--d-hi)" ${FONT} style="letter-spacing:.5px">11:59</text></g>
        ${pump(u, 200, "1,99")}
        <path d="M128 132 h-12 M131 140 h-18 M128 148 h-10" stroke="var(--d-motion)" stroke-width="2" stroke-linecap="round"/>
        ${shadow(156, 10)}${person(u, { who: "A", x: 156, lean: 10, face: "open", near: [11, -117, 20, -102, 28, -94], far: [-10, -117, -22, -106, -24, -122],
          legs: [[-5, -76, -24, -52, -34, -28, -30], [5, -76, 20, -44, 24, -4, 6]],
          hold: `<g transform="translate(24 -96) rotate(6)"><rect x="0" y="0" width="17" height="22" rx="3" fill="var(--d-hi)"/><rect x="5" y="-5" width="7.5" height="6" rx="1.6" fill="var(--d-hi2)"/></g>` })}
        ${shadow(92, 9)}${person(u, { who: "B", x: 92, face: "open", near: [11, -117, 22, -124, 30, -136], far: [-10, -117, -14, -98, -12, -82] })}${END}`,
      lines: [["B", "Hannes, glei isch's zwölfe – dann goht's nauf!"], ["A", "Zwölfe isch erscht, wenn i's sag!"]] },
    fuenf: { t: "Bloß für fümf Euro",
      svg: (u) => `${stage(u)}${pump(u, 104, "5,00")}${car(u, 40, false, 1.05, 166)}
        ${shadow(80, 10)}${person(u, { who: "A", x: 80, shades: true, near: [11, -117, 22, -126, 28, -142], far: [-10, -117, -13, -98, -10, -82],
          hold: `<g transform="translate(22 -156) rotate(-10)"><rect width="22" height="12" rx="1.6" fill="var(--d-money)"/><rect x="2" y="2" width="18" height="8" rx="1" fill="none" stroke="#fff" stroke-width=".7" opacity=".6"/><text x="11" y="9" text-anchor="middle" font-size="7.5" font-weight="800" fill="#fff" ${FONT}>5</text></g>` })}
        ${shadow(184, 9)}${person(u, { who: "B", x: 184, flip: true, near: [11, -117, 18, -100, 8, -86], far: [-10, -117, -16, -100, -8, -86] })}${END}`,
      lines: [["B", "Machsch voll?"], ["A", "Noi, bloß für fümf Euro."], ["B", "Ond dr Rescht?"], ["A", "Der wird morga billiger."]] },
    haeusle: { t: "S'Häusle",
      svg: (u) => `${stage(u, false, false)}
        <g transform="translate(212 118)"><path d="M-16 0 L0 -13 L16 0Z" fill="var(--d-roof)"/><rect x="-12.5" y="0" width="25" height="18" fill="var(--d-house)"/><rect x="-3" y="7" width="6" height="11" fill="var(--d-door)"/><rect x="6" y="4" width="4.5" height="4.5" fill="var(--d-glass1)"/><rect x="-10" y="4" width="4.5" height="4.5" fill="var(--d-glass1)"/></g>
        ${pump(u, 12, "1,89")}
        ${PIG(122, 158)}<circle cx="120" cy="136" r="5" fill="var(--d-coin)"/><text x="120" y="138.6" text-anchor="middle" font-size="6.5" font-weight="800" fill="var(--d-gold2)" ${FONT}>€</text>
        ${shadow(88, 10)}${person(u, { who: "A", x: 88, near: [11, -117, 26, -110, 44, -100], far: [-10, -117, -13, -98, -10, -82] })}
        ${shadow(176, 9)}${person(u, { who: "B", x: 176, flip: true, near: [11, -117, 17, -98, 16, -82], far: [-10, -117, -14, -98, -12, -82] })}${END}`,
      lines: [["B", "Wann baust du eigentlich dei Häusle?"], ["A", "Bin scho dabei."], ["B", "An dr Tankstell?"], ["A", "Jeder Cent, den i do spar, isch a Ziegel."]] },
    nachts: { t: "Nachts om zwoi",
      svg: (u) => `${stage(u, true)}
        <path d="M204 34 a11 11 0 1 0 7.6 18.6 a8.6 8.6 0 1 1 -7.6 -18.6z" fill="var(--d-moon)"/>
        <g fill="var(--d-star)"><circle cx="172" cy="40" r="1.2"/><circle cx="228" cy="76" r="1"/><circle cx="26" cy="44" r="1.1"/><circle cx="98" cy="36" r="1"/></g>
        <ellipse cx="120" cy="164" rx="112" ry="32" fill="url(#glow${u})"/>
        ${pump(u, 112, "1,74", "lo")}${car(u, 40, false, 1.05, 166)}
        ${shadow(84, 10)}${person(u, { who: "A", x: 84, near: [11, -117, 22, -112, 34, -112], far: [-10, -117, -13, -98, -10, -82] })}
        ${shadow(188, 9)}${person(u, { who: "B", x: 188, flip: true, pj: true, face: "yawn", near: [11, -117, 10, -128, 13, -138], far: [-10, -117, -14, -98, -12, -82] })}${END}`,
      lines: [["B", "Hannes … 's isch zwoi en dr Nacht."], ["A", "Grad isch dr Sprit am billigschda."], ["B", "Ond dr Schlof?"], ["A", "Schlofa ka i, wenn's deirer isch."]] },
  };
  const NAMES = { A: "Hannes", B: "Lena" };
  const POS = { tropfa: { A: 29, B: 85 }, schieba: { A: 28, B: 76 }, zwoelfe: { A: 68, B: 40 }, fuenf: { A: 35, B: 76 }, haeusle: { A: 38, B: 73 }, nachts: { A: 36, B: 78 } };

  // ---- Auswahl: passend zur Tageszeit, sonst täglich wechselnd; „Nägschder“ blättert weiter
  const KEYS = Object.keys(WITZE);
  let extra = 0;                 // weitergeblättert in dieser Sitzung
  const played = new Set();      // schon abgespielt (nicht bei jedem Neuaufbau wiederholen)
  function pick() {
    const now = new Date(), h = now.getHours();
    const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const daily = KEYS.filter((x) => x !== "nachts" && x !== "zwoelfe");   // diese zwei nur zur passenden Uhrzeit
    let k = daily[day % daily.length];
    if (h < 5) k = "nachts";
    else if (h >= 10 && h < 12) k = "zwoelfe";
    return KEYS[(KEYS.indexOf(k) + extra) % KEYS.length];
  }
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function render() {
    const el = document.getElementById("witz");
    if (!el) return;
    if (store.get("witz", "1") !== "1") { el.innerHTML = ""; return; }
    const k = pick(), W = WITZE[k], u = ++UID, last = W.lines.length - 1;
    el.innerHTML = `<section class="card wz"><div class="wzhead"><span class="eyebrow">😄 ${say("Witz vom Dag", "Witz des Tages")}</span><span class="sub">${W.t}</span></div>
      <div class="wzstage"><svg viewBox="0 0 240 180" role="img" aria-label="${W.t}: Hannes und Lena an der Tankstelle">${defs(u, k === "nachts")}${W.svg(u)}</svg><div class="wzbub" aria-hidden="true"></div></div>
      <ol class="wzdlg">${W.lines.map(([w, t], i) => `<li class="${i === last ? "last" : ""}"><b>${NAMES[w]}</b><span>${t}</span></li>`).join("")}</ol>
      <div class="row two"><button class="btn secondary" data-witz="nomol">▶ Nomol</button><button class="btn secondary" data-witz="next">Nägschder →</button></div></section>`;
    const bub = el.querySelector(".wzbub"), lis = el.querySelectorAll(".wzdlg li");
    let timer = null;
    const show = (i) => {
      const [w, t] = W.lines[i], x = POS[k][w], cx = Math.min(Math.max(x, 33), 67);
      bub.className = "wzbub"; void bub.offsetWidth;
      bub.textContent = t; bub.classList.toggle("punch", i === last);
      bub.style.left = cx + "%"; bub.style.setProperty("--tail", `calc(50% + ${(x - cx) * 1.6}%)`);
      bub.classList.add("show");
      lis.forEach((li, j) => li.classList.toggle("on", j <= i));
    };
    const play = () => {
      clearTimeout(timer);
      played.add(k);
      if (reduce()) return show(last);
      let i = 0;
      const step = () => { if (!bub.isConnected) return; show(i); const d = 900 + W.lines[i][1].length * 45; if (++i <= last) timer = setTimeout(step, d); };
      step();
    };
    el._play = play;
    if (played.has(k)) return show(last);
    if (!("IntersectionObserver" in window)) return play();
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); play(); } }, { threshold: .6 }).observe(el.querySelector(".wzstage"));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-witz]");
    if (!b) return;
    if (b.dataset.witz === "next") { extra++; render(); document.getElementById("witz")?._play?.(); }
    else document.getElementById("witz")?._play?.();
  });
  return { render };
})();
