// Offscreen sampling sources for the timeline's dot formations.
// Solid forms and shaded details keep each chapter legible at phone sizes.
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="640" height="640">
 <defs>
  <linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c2e6dc"/><stop offset=".55" stop-color="#75b9ad"/><stop offset="1" stop-color="#327a78"/></linearGradient>
  <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#36596b"/><stop offset="1" stop-color="#102c3c"/></linearGradient>
  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#deebe4"/><stop offset="1" stop-color="#90bcb5"/></linearGradient>
 </defs>${body}</svg>`;
export const timelineArt = {
 basketball: wrap(`<circle cx="160" cy="156" r="120" fill="url(#a)" stroke="#b5ddcf" stroke-width="2"/>
  <g transform="rotate(-18 160 156)" fill="none" stroke="#194b50" stroke-width="10">
   <path d="M40 156h240M160 36v240M76 70c64 51 64 121 0 172M244 70c-64 51-64 121 0 172"/>
  </g><path d="M77 97c22-29 55-44 91-42" fill="none" stroke="#e4f4e6" stroke-opacity=".5" stroke-width="3"/>`),
 graduation: wrap(`<path d="M83 144v75c49 30 105 30 154-2v-76Z" fill="url(#b)" stroke="#87b7b5" stroke-width="2"/>
  <path d="m29 114 128-66 136 63-133 73Z" fill="url(#a)" stroke="#bfdfd2" stroke-width="2"/>
  <path d="m29 114 131 70 133-73v12l-133 73L29 126Z" fill="#37686b"/>
  <path d="m160 115 95 31v78" fill="none" stroke="#dbeacb" stroke-width="4"/>
  <circle cx="160" cy="115" r="7" fill="#2a6264"/>
  <path d="M247 225h17l5 33h-27Z" fill="#c6dec0"/>
  <path d="m65 257 122-13 3 25-122 13Z" fill="url(#paper)"/><path d="m126 250 14-2 3 25-14 2Z" fill="#4c9c8e"/>`),
 crypto: wrap(`<path d="M99 164v60h119M222 154V96H117" stroke="#69b7ae" stroke-width="3" stroke-dasharray="5 7" fill="none"/>
  <path d="m33 77 66-38 66 38-66 39Z" fill="url(#paper)"/>
  <path d="m33 77 66 39v79l-66-39Z" fill="#438b86"/><path d="m99 116 66-39v79l-66 39Z" fill="#285c66"/>
  <path d="m155 169 66-38 66 38-66 39Z" fill="url(#a)"/>
  <path d="m155 169 66 39v79l-66-39Z" fill="#438b86"/><path d="m221 208 66-39v79l-66 39Z" fill="#285c66"/>
  <g fill="none" stroke="#b8e1d4" stroke-width="1.5"><path d="m33 77 66 39 66-39M99 116v79m56-26 66 39 66-39M221 208v79"/></g>`),
 business: wrap(`<g stroke="#75a8a3" stroke-width="1.5">
  <path d="M38 172h63v94H38Z" fill="url(#b)"/><path d="m38 172 18-14h62l-17 14Z" fill="#87b9b0"/><path d="m101 172 17-14v94l-17 14Z" fill="#285461"/>
  <path d="M123 122h62v144h-62Z" fill="url(#b)"/><path d="m123 122 18-14h62l-18 14Z" fill="#a3ccc0"/><path d="m185 122 18-14v144l-18 14Z" fill="#285461"/>
  <path d="M208 65h62v201h-62Z" fill="url(#a)"/><path d="m208 65 18-14h62l-18 14Z" fill="#cae4d4"/><path d="m270 65 18-14v201l-18 14Z" fill="#337b77"/>
  </g><path d="M36 126 102 83l34 8 47-46m-26 0h26v26" fill="none" stroke="#9be0ca" stroke-width="4"/>`),
 finance: wrap(`<rect x="62" y="36" width="199" height="258" rx="18" fill="#0e2534" stroke="#396376" stroke-width="3"/>
  <rect x="54" y="27" width="199" height="258" rx="18" fill="url(#b)" stroke="#8fb6b5" stroke-width="2"/>
  <rect x="75" y="49" width="157" height="59" rx="6" fill="url(#a)"/>
  <path d="M160 70h18v19h-18Zm31 0h18v19h-18Z" fill="none" stroke="#295f62" stroke-width="2"/>
  <g fill="url(#paper)"><rect x="76" y="131" width="35" height="29" rx="4"/><rect x="132" y="131" width="35" height="29" rx="4"/>
  <rect x="76" y="177" width="35" height="29" rx="4"/><rect x="132" y="177" width="35" height="29" rx="4"/>
  <rect x="76" y="224" width="35" height="29" rx="4"/><rect x="132" y="224" width="35" height="29" rx="4"/></g>
  <rect x="188" y="131" width="35" height="29" rx="4" fill="#559e91"/><rect x="188" y="177" width="35" height="76" rx="4" fill="url(#a)"/>
  <path d="M198 207h16m-16 13h16" stroke="#214e51" stroke-width="3"/>`),
 learning: wrap(`<path d="M31 68q66-18 129 14 63-32 129-14v199q-70-15-129 13-59-28-129-13Z" fill="#285c63" stroke="#5b9997" stroke-width="2"/>
  <path d="M40 56q66-13 120 17 54-30 120-17v199q-66-10-120 14-54-24-120-14Z" fill="#709e99"/>
  <path d="M46 44q65-8 114 20v191q-60-28-114-17Z" fill="url(#paper)"/>
  <path d="M160 64q49-28 114-20v194q-54-11-114 17Z" fill="#c8ddd2"/>
  <path d="M160 65v190" stroke="#426e70" stroke-width="3"/>
  <g fill="none" stroke="#688f8b" stroke-width="3"><path d="M67 85q35 0 70 14M67 118q35 0 70 14M67 151q35 0 70 14M67 184q35 0 48 7M184 99q33-14 67-14M184 132q33-14 67-14M184 165q33-14 67-14M184 198q33-14 67-14"/></g>
  <path d="M220 48h18v62l-9-9-9 9Z" fill="#3f9385"/>`),
 markets: wrap(`<g fill="none" stroke="#3b5f71" stroke-width="1"><path d="M29 46v227h263M29 103h263M29 160h263M29 217h263"/></g>
  <g stroke="#8dc5bb" stroke-width="3"><path d="M66 135v123M128 46v135M191 104v125M253 32v110"/></g>
  <g stroke-width="2"><path d="M49 165h34v63H49Z" fill="url(#a)" stroke="#a8d8c8"/><path d="M111 65h34v57h-34Z" fill="url(#a)" stroke="#a8d8c8"/>
  <path d="M174 130h34v65h-34Z" fill="url(#b)" stroke="#8aabb2"/><path d="M236 49h34v40h-34Z" fill="url(#a)" stroke="#a8d8c8"/></g>`),
 sumlino: '/sumlino-founder.png',
 mountains: wrap(`<circle cx="201" cy="91" r="45" fill="#d2ba98"/>
  <path d="m18 235 80-136 51 67 45-52 111 130Z" fill="#598d91"/>
  <path d="m22 244 108-150 50 78 41-40 85 112Z" fill="url(#a)"/>
  <path d="m130 94-23 70 23-13 20 20 6-36Z" fill="#d4e8dc"/>
  <path d="m130 94 50 78-20 23 34 49h-64Z" fill="#3a6b75"/>
  <path d="m23 249 87-27 55 18 40-26 102 36v20H23Z" fill="#4b8181"/>
  <path d="m166 269 11-12-20-9 18-12" fill="none" stroke="#b6dace" stroke-width="3"/>`),
};
