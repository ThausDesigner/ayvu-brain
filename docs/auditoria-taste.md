---
tags: [design, qa, ayvu]
status: active
agent: codex
created: 2026-11-24
updated: 2026-11-24
---

# Auditoria automática da skill de design

GATE: OPEN 50 (rodada 3 de 3). Nenhuma dispensa foi cadastrada. Esta execução antecede a troca final do chat para CLIs. Não foi apresentada como aprovação visual.

O checker depende do DOM e dos componentes do próprio kit, incluindo detecção dos fragmentos HTML, classes de motion e composição em telas exatas. A revisão visual observou prévias HTML reais nas seções sinalizadas como sem visual, foco e hover implementados no CSS, grid simétrico e rodapé em colunas. Isso não elimina os achados do checker: seguem abaixo integralmente para revisão. A documentação principal distingue essa auditoria dos 24 checks funcionais no navegador.

## Achados abertos

| Check | Alvo | Observação | Correção sugerida pelo checker |
| --- | --- | --- | --- |
| no-visual | section#inicio "Seu segundo cérebro. Agora, em um worksp" | no picture, effect or mock in this section; a feature section needs a visual | give the section a visual: a UI fragment on a ground, real icons, or a photograph that fits |
| no-visual | section#workspace "O contexto vai junto." | no picture, effect or mock in this section; a feature section needs a visual | give the section a visual: a UI fragment on a ground, real icons, or a photograph that fits |
| no-visual | section#instalar "Seu próximo workspace começa aqui." | no picture, effect or mock in this section; a feature section needs a visual | give the section a visual: a UI fragment on a ground, real icons, or a photograph that fits |
| copy-headings | div#hero-demo > h3 "Um lugar para continuar." | "Um lugar para continuar." names no product, part, place or section (4 headings like it; at most one brand line per page) (and 3 more like it: "O contexto vai junto.", "Continue de onde parou.", "Escolha com quem pensar.") | name the thing in every heading: the product, a part, the place or a section noun |
| motion-layer | html[data-motion] | the page marks <html data-motion> but motion.css is not loaded: buttons, links, cards and photos answer nothing on hover | link assets/motion/motion.css after cards.css and keep data-motion on <html> (both, or neither) |
| focus-visible | button#tab-overview "Visão geral Fios e memória do workspace" | Tab stop 17, button "Visão geral Fios e memória do workspace": the focus lands on something you cannot see | keep the kit's ring (system.css :focus-visible, 2px in --action, there at once); a control that hides itself shows on focus |
| hero-enter | section#inicio | the hero does not enter on load: no data-enter on the hero and no head line setting html.m-enter (motion.md, The hero's entrance) | put data-enter on the hero <section> and keep the head line from starter.html that sets html.m-enter |
| moment-none | (the page) | a software page (--type) deals no moment: every kind carries one, two on a long page (moments.md) | deal one (moments.mjs pick --page software) and mount it in its own section |
| section-height | footer.footer "AYVU BrainUm workspace local para seu se" | the section is 345px tall (0.4 screens), 555px short of one screen (900px): every section after the hero is one screen or two, 2px either way (SR-2) | set the section to one screen or two (height: calc(var(--h,1) * 100vh), --h 1 or 2) and cut or split its content to fit |
| section-height | section#inicio "Local-first v0.2.0 para WindowsSeu segun" | the section starts at 71px, 71px below the screen grid (0 x 900px): sections start on whole screens (SR-2) | make every section above it exactly one or two screens tall, so this one starts on a whole screen |
| one-section | footer.footer "AYVU BrainUm workspace local para seu se" | the screen at scroll 3946px (the top of section 6) shows 345px of section 6 and the content of 2 sections, over 24px each beside section 5: a screen shows one section (another may peek 8px, 24px WARN) (SR-4) | make each section exactly one screen or two, so a screen shows one section and no neighbour peeks |
| one-section | section#workspace "01 / WorkspaceO contexto vai junto.Da pr" | the screen at scroll 71px (the top of section 1) shows 70px of section 2 beside section 1: a screen shows one section (another may peek 8px, 24px WARN) (SR-4) | make each section exactly one screen or two, so a screen shows one section and no neighbour peeks |
| container-edges | section#inicio "Local-first v0.2.0 para WindowsSeu segun" | the content of section 1 runs 152px from the left and 152px from the right (read from its outermost blocks: no .wrap): the page's container starts at 120px; the margin is 64-120px at 1440px (one container, equal margins, 2px either way) (SR-6) | use one container on every section and the nav (.wrap): one margin left and right, 64-120px on a desktop, 16-24px on a phone |
| container-edges | header.nav-wrap "AYVU BrainWorkspaceProvedoresSeus arquiv" | the nav's first box starts at 152px and its last ends at 1288px, not on its .wrap at 120-1320px (SR-6) | use one container on every section and the nav (.wrap): one margin left and right, 64-120px on a desktop, 16-24px on a phone |
| container-edges | a.skip-link "Pular para o conteúdo" | a <a> at the top of the page, outside header.nav, main, footer.closing and nav.actionbar (SR-6) | build the page as header.nav, a main of sections (each one in-flow .wrap plus background layers) and footer.closing |
| container-edges | section#local > div.wrap.local-grid > div.local-copy > p.kicker "03 / Local-first" | 1 text block starts on a left line at x 825, 705px from the container's left: text starts on the container's left, or on one split line (x 630, 732, 834) (SR-6) | start the text on the container's left, or on the one split line every split shares |
| container-edges | section#local > div.wrap.local-grid > div.local-copy > h2 "Sua memória ficano seu computador." | 2 text blocks start on a left line at x 797, 677px from the container's left: text starts on the container's left, or on one split line (x 630, 732, 834) (also "As notas continuam em Markdown, ") (and 7 more like it: "Sua memória ficano seu c", x 567, x 331) (SR-6) | start the text on the container's left, or on the one split line every split shares |
| container-edges | section#workspace > div.wrap > div.module-grid "Visão geralFios e memória do workspaceVa" | a box over half the container wide runs 152-1288px, not on the container's lines at 120-1320px (SR-6) | run the picture or box from the container's left line to its right line, or put it in a row or a split |
| container-edges | footer.footer > div.wrap > div.foot-bottom "© 2026 AYVU · Brain v0.2.0 · Código sob " | a box over half the container wide runs 152-1288px, not on the container's lines at 120-1320px (SR-6) | run the picture or box from the container's left line to its right line, or put it in a row or a split |
| row-lines | div#hero-demo > div.frame-content "Fios do workspacePlanejamento da semanac" | a row of 2 items: its first item starts at 363px, the container's left line at 152px; its last item ends at 1257px, the container's right line at 1288px (2px either way) (SR-7) | start the row's first item on the container's left line and end its last on the right line, every item one height |
| row-lines | footer.footer > div.wrap > div.foot-grid "AYVU BrainUm workspace local para seu se" | a row of 4 items: its first item starts at 152px, the container's left line at 120px; its last item ends at 1288px, the container's right line at 1320px (2px either way) (SR-7) | start the row's first item on the container's left line and end its last on the right line, every item one height |
| row-lines | section#provedores > div.wrap > div.providers "CClaudeConversa e análise com o contexto" | a row of 4 items: its first item starts at 152px, the container's left line at 120px; its last item ends at 1288px, the container's right line at 1320px (2px either way) (SR-7) | start the row's first item on the container's left line and end its last on the right line, every item one height |
| split-pair | section#local > div.wrap.local-grid "Seu vaultAYVU BrainSua IA_knowledge/.md_" | the two columns of the split start 74px apart at the top: a split's columns are top-aligned, 8px either way (SR-8) | top-align both columns of the split (align-items: start) |
| split-pair | section#instalar > div.wrap.install-grid "04 / InstalaçãoSeu próximo workspacecome" | the two columns of the split start 39px apart at the top: a split's columns are top-aligned, 8px either way (SR-8) | top-align both columns of the split (align-items: start) |
| tap-size | div.providers > article.provider:nth-of-type(2) > div.provider-foot > a "Conectar" | a 65x30px tap target: 0px from the next one ("Abrir workspace"), so a thumb lands on the wrong one | make every link and control outside running text 44px tall on a phone: display: inline-flex; align-items: center; min-height: 44px (a footer list then needs no gap), a 44px small button, or a transparent ::before laid past the box |
| edge-left | #inicio p.frame-label "SEU WORKSPACE" | starts at x 363; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #inicio h3 "Um lugar para continuar." | starts at x 363; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #inicio p "Contexto, conversas e trabalho. " | starts at x 363; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #workspace p "Da primeira nota à próxima entre" | starts at x 968; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #workspace h3 "Continue de onde parou." | starts at x 533; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #workspace p "Acompanhe seus fios e abra a mem" | starts at x 533; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #provedores p "Converse com quatro provedores n" | starts at x 968; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #provedores h3 "Claude" | starts at x 177; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #provedores p "Conversa e análise com o context" | starts at x 177; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #provedores h3 "OpenAI / Codex" | starts at x 464; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #provedores p "Chat via API e Codex CLI para ta" | starts at x 464; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #provedores h3 "Gemini" | starts at x 751; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #provedores p "Chat, ditado por voz e resumo de" | starts at x 751; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #provedores h3 "Grok" | starts at x 1038; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #provedores p "Conversa via API da xAI com o co" | starts at x 1038; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-right | #local div.local-visual "Seu vaultAYVU BrainSua IA_knowle" | ends at x 716.8; the right line is 1288 | end it on the .wrap right line |
| edge-left | #local div.local-copy "03 / Local-firstSua memória fica" | starts at x 796.8; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #local p.kicker "03 / Local-first" | starts at x 796.8; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #local h2 "Sua memória ficano seu computado" | starts at x 796.8; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #local p "As notas continuam em Markdown, " | starts at x 796.8; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #instalar div "PowerShell / InstalaçãoCopiar co" | starts at x 760; the lines are 152 and the column starts | start it on the .wrap left line |
| edge-left | #instalar p.live-message | starts at x 760; the lines are 152 and the column starts | start it on the .wrap left line |
| lines | page | headings and leads start on 3 lines (x 152, 968, 796.8); the page has 152 and one split line | put the block on the .wrap lines or the grid columns |
| hero-fold | #inicio section.hero.wrap "Local-first v0.2.0 para WindowsS" | starts at y 71, not under the nav | the hero fills the first screen alone, its button inside it |
| neighbour | #provedores section.section.providers-section "02 / Suas conexõesEscolha com qu" | framed, 74px of #local section.section "Seu vaultAYVU BrainSua IA_knowle" shows | keep the next section's heading and picture out of this screen |

## Avisos

- off-grid · section#local > div.wrap.local-grid > div.local-copy > h2 "Sua memória fica no seu computador." · the section's heading starts at 797px, 645px off the page margin (152px), and no other section starts there
- col-edge · div#module-panel "Continue de onde parou. Acompanhe seus f" · the second column starts at 4 places: 493px (section#workspace), 760px (section#instalar), 797px (section#local), 891px (section#inicio)
- body-size · section#workspace > div.wrap > div.section-head > p "Da primeira nota à próxima entrega, o AY" · 5 of 5 paragraphs of running text are set under 16px (13, 14px)
- section-gaps · section#inicio / section#workspace · 168px between these sections, -55% against the median 370px
- nav-labels · nav#site-nav > a:nth-of-type(1) "Workspace" · "Workspace" opens a section headed "O contexto vai junto."
- nav-labels · nav#site-nav > a:nth-of-type(2) "Provedores" · "Provedores" opens a section headed "Escolha com quem pensar."
- nav-labels · nav#site-nav > a:nth-of-type(4) "Instalação" · "Instalação" opens a section headed "Seu próximo workspace começa aqui."
- tab-wrap · button#tab-system "Sistema Versões e atalhos" · the row of 6 tabs wraps onto 6 lines and leaves "Sistema Versões e atalhos" alone on the last
- copy-length · section#local "Sua memória fica no seu computador." · 5 sections over 90 words a screen outside the UI mocks ("Sua memória fica no seu " 143, "Seu próximo workspace co" 125, "Seu segundo cérebro. Ago" 112); 114 words a screen across the page (569 words in 5 screens): a tech page says it in about 80 or fewer
- nav-current · header.nav-wrap · the nav stays on screen with 4 links to the page's sections, but never marks the one you are in (no link changes as the page scrolls)
- split-align · section#local > div.wrap.local-grid "Sua memória fica no seu computador." · the picture beside "Sua memória fica no seu comput" sits centred on a text column 127px taller: its top and bottom line up with nothing
- skip-link · a.skip-link "Pular para o conteúdo" · the first Tab stop is "Pular para o conteúdo", not a skip link: a keyboard user tabs through the whole nav on every visit
- share-meta · head · the head lacks og:image, twitter:card: a shared link shows no picture or title of its own
- action-repeat · header.nav-wrap > div.wrap.nav-inner > a.btn:nth-of-type(2) "abrir workspace" · "abrir workspace" shows 2 times on the first screen at 1440px (nav, hero): the nav's button and the hero's; nothing else on the screen may repeat it
- section-air · section#instalar "04 / InstalaçãoSeu próximo workspacecome" · the content fills 48.2% of the section's height (434 of 900px): 55% or more (40% WARN) (SR-3)
- section-air · section#provedores "02 / Suas conexõesEscolha com quem pensa" · the content fills 51.7% of the section's height (466 of 900px): 55% or more (40% WARN) (SR-3)
- section-air · section#local "Seu vaultAYVU BrainSua IA_knowledge/.md_" · the content fills 52.3% of the section's height (472 of 900px): 55% or more (40% WARN) (SR-3)
- tap-size · header.nav-wrap > div.wrap.nav-inner > a.brand "AYVU Brain" · a 113x28px tap target: under the 44px a phone needs
- tap-size · header.nav-wrap > div.wrap.nav-inner > a.btn "Abrir workspace" · a 99x34px tap target: under the 44px a phone needs
- tap-size · button#menu-toggle · a 34x36px tap target: under the 44px a phone needs
- tap-size · section#inicio > a.release-pill "Local-first v0.2.0 para Windows" · a 204x30px tap target: under the 44px a phone needs
- tap-size · section#inicio > div.hero-actions > a.btn:nth-of-type(1) "Abrir workspace" · a 167x42px tap target: under the 44px a phone needs
- tap-size · section#inicio > div.hero-actions > a.btn.sec "Instalar no Windows" · a 167x42px tap target: under the 44px a phone needs
- tap-size · div.app-frame > div.frame-body > div.frame-side > button.active "Visão geral" · a 35x34px tap target: under the 44px a phone needs
- tap-size · div.app-frame > div.frame-body > div.frame-side > button:nth-of-type(2) "Vault" · a 35x34px tap target (and 4 more like it on this screen): under the 44px a phone needs
- tap-size · a#module-open "Abrir no workspace" · a 118x36px tap target: under the 44px a phone needs
- tap-size · div.providers > article.provider:nth-of-type(1) > div.provider-foot > a "Conectar" · a 65x30px tap target: under the 44px a phone needs
- tap-size · div.local-copy > div.faq > details:nth-of-type(1) > summary "O que fica no computador?" · a 342x32px tap target (and 2 more like it on this screen): under the 44px a phone needs
- tap-size · div.install-copy > div.install-disclosure > details:nth-of-type(1) > summary "Versões e rollback" · a 342x26px tap target (and 1 more like it on this screen): under the 44px a phone needs
- tap-size · button#copy-install "Copiar comandos" · a 98x28px tap target: under the 44px a phone needs
- tap-size · div.wrap > div.foot-grid > div.foot-brand > a.brand "AYVU Brain" · a 342x28px tap target: under the 44px a phone needs
- tap-size · div.foot-col:nth-of-type(2) > ul > li:nth-of-type(1) > a "Workspace" · a 56x32px tap target (and 10 more like it on this screen): under the 44px a phone needs
- heading-scale · h3#module-title "Continue de onde parou." · h3 headings in 3 sizes, 16px ("Claude") to 20px (x1.25)
