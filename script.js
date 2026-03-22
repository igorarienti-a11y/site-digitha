/* =============================================
   DÍGITHA LANDING PAGE — GSAP v3 + Motion
   Services Wheel with ScrollTrigger Pin + Entrance + Rotation
   ============================================= */

gsap.registerPlugin(ScrollTrigger);

// Sempre volta ao topo no refresh
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('beforeunload', () => window.scrollTo(0, 0));
window.addEventListener('load', () => window.scrollTo(0, 0));

// Motion (motion.dev) — disponível via window.Motion
const { animate: motionAnimate, hover, press, inView } = Motion;

// Evita refreshes desnecessários quando o teclado mobile aparece/some
ScrollTrigger.config({ ignoreMobileResize: true, fastScrollEnd: true });

// =========================================
// PRELOADER
// =========================================
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    gsap.to(preloader, {
        opacity: 0,
        duration: 0.6,
        delay: 1.6,
        ease: 'power2.inOut',
        onComplete: () => {
            preloader.classList.add('hidden');
            initAnimations();
        }
    });
});

function initAnimations() {

    // =========================================
    // SCROLL PROGRESS BAR
    // =========================================
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);
    ScrollTrigger.create({
        start: 'top top',
        end: 'max',
        onUpdate: (self) => gsap.set(progressBar, { scaleX: self.progress }),
    });

    // =========================================
    // HEADER SCROLL EFFECT
    // =========================================
    const header = document.getElementById('header');
    ScrollTrigger.create({
        start: 'top -60',
        onUpdate: () => {
            if (window.scrollY > 60) {
                header.classList.add('header--scrolled');
            } else {
                header.classList.remove('header--scrolled');
            }
        }
    });

    // =========================================
    // MOBILE MENU
    // =========================================
    const hamburger = document.getElementById('hamburger');
    const nav = document.getElementById('nav');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        nav.classList.toggle('active');
        document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
    });

    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            nav.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // =========================================
    // HERO ENTRANCE — Staggered reveal
    // =========================================
    const heroElements = document.querySelectorAll('[data-gsap="hero"]');
    gsap.set(heroElements, { opacity: 0, y: 40 });

    gsap.to(heroElements, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.15,
        ease: 'power3.out',
        delay: 0.2,
    });

    // =========================================
    // SECTION FADE-UP — Clip-path reveal
    // =========================================
    gsap.utils.toArray('[data-gsap="fade-up"]').forEach(el => {
        gsap.from(el, {
            scrollTrigger: {
                trigger: el,
                start: 'top 88%',
                toggleActions: 'play none none none',
            },
            opacity: 0,
            y: 40,
            clipPath: 'inset(0 0 100% 0)',
            duration: 0.9,
            ease: 'power3.out',
        });
    });

    // =========================================
    // LETTER BOUNCE — Split chars, animate L→R
    // =========================================
    gsap.utils.toArray('[data-gsap="letter-bounce"]').forEach(el => {
        const units = []; // cada unidade animável: char span ou word span

        [...el.childNodes].forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const frag = document.createDocumentFragment();
                [...text].forEach(ch => {
                    const s = document.createElement('span');
                    s.className = 'char';
                    s.textContent = ch === ' ' ? '\u00A0' : ch;
                    frag.appendChild(s);
                    units.push(s);
                });
                node.replaceWith(frag);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Span com gradiente: anima como unidade inteira para preservar o gradient
                node.classList.add('char');
                units.push(node);
            }
        });

        gsap.set(units, { opacity: 0, y: 60, rotationZ: () => gsap.utils.random(-12, 12) });

        ScrollTrigger.create({
            trigger: el,
            start: 'top 85%',
            onEnter: () => {
                gsap.to(units, {
                    opacity: 1,
                    y: 0,
                    rotationZ: 0,
                    duration: 0.55,
                    stagger: 0.03,
                    ease: 'back.out(2.5)',
                });
            },
            once: true,
        });
    });

    // =========================================
    // STAGGER CARDS
    // =========================================
    const cardGroups = {};
    gsap.utils.toArray('[data-gsap="stagger-card"]').forEach(el => {
        const parent = el.parentElement;
        const key = parent.className || parent.id || 'group_' + Math.random();
        if (!cardGroups[key]) cardGroups[key] = [];
        cardGroups[key].push(el);
    });

    Object.values(cardGroups).forEach(cards => {
        gsap.set(cards, { opacity: 0, y: 70, scale: 0.92, rotationX: 12, transformPerspective: 800 });
        ScrollTrigger.create({
            trigger: cards[0].parentElement,
            start: 'top 80%',
            onEnter: () => {
                gsap.to(cards, {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    rotationX: 0,
                    duration: 0.8,
                    stagger: 0.12,
                    ease: 'back.out(1.4)',
                });
            },
            once: true,
        });
    });

    // =========================================
    // SECTION TITLES — split-text clip reveal
    // =========================================
    gsap.utils.toArray('[data-gsap="split-text"]').forEach(el => {
        gsap.from(el, {
            scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none none',
            },
            opacity: 0,
            y: 80,
            duration: 1,
            ease: 'power4.out',
        });
    });

    // =========================================
    // ANIMATED COUNTERS
    // =========================================
    gsap.utils.toArray('[data-counter]').forEach(el => {
        const target = parseInt(el.getAttribute('data-counter'));
        ScrollTrigger.create({
            trigger: el,
            start: 'top 85%',
            onEnter: () => {
                gsap.to(el, {
                    innerHTML: target,
                    duration: 2,
                    ease: 'power1.out',
                    snap: { innerHTML: 1 },
                    onUpdate: function () {
                        el.textContent = Math.round(parseFloat(el.textContent));
                    }
                });
            },
            once: true,
        });
    });

    // =========================================
    // ★ SERVICES WHEEL — Ferris wheel
    //   Phase 1 (0–20% scroll): wheel slides in from right
    //   Phase 2 (20–100% scroll): wheel rotates through all 6 services
    // =========================================
    const TOTAL_SERVICES = 6;
    const ANGLE_PER_SERVICE = 360 / TOTAL_SERVICES; // 60°
    const WHEEL_RADIUS_RATIO = 0.42;

    const wheelSection  = document.querySelector('.wheel-section');
    const wheelVisual   = document.getElementById('wheel-visual');
    const wheelRotator  = document.getElementById('wheel-rotator');
    const wheelCenter   = document.querySelector('.wheel-center'); // inside rotator → we counter-rotate it
    const wheelNodes    = document.querySelectorAll('.wheel-node');
    const wheelPanels   = document.querySelectorAll('.wheel-info__panel');
    const wheelDots     = document.querySelectorAll('.wheel-dot');
    const wheelCounter  = document.getElementById('wheel-counter');
    let currentActiveIndex = 0;

    // ── Position nodes around the circle ──────────────────────────
    function positionNodes() {
        const size   = wheelVisual.offsetWidth || 700;
        const radius = size * WHEEL_RADIUS_RATIO;
        const cx     = size / 2;
        const cy     = size / 2;
        const ns     = wheelNodes[0]?.offsetWidth || 80;

        wheelNodes.forEach((node, i) => {
            // CRM starts at 180° (left = active position), then clockwise every 60°
            const deg = 180 + i * ANGLE_PER_SERVICE;
            const rad = deg * Math.PI / 180;
            node.style.left = (cx + radius * Math.cos(rad) - ns / 2) + 'px';
            node.style.top  = (cy + radius * Math.sin(rad) - ns / 2) + 'px';
        });
    }

    positionNodes();
    window.addEventListener('resize', () => { positionNodes(); ScrollTrigger.refresh(); });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => { positionNodes(); ScrollTrigger.refresh(); }, 300);
    });

    // ── Switch active service ──────────────────────────────────────
    function setActiveService(index) {
        if (index === currentActiveIndex) return;

        wheelPanels.forEach((p, i) => p.classList.toggle('active', i === index));
        wheelNodes.forEach((n, i)  => n.classList.toggle('active', i === index));
        wheelDots.forEach((d, i)   => d.classList.toggle('active', i === index));

        wheelCounter.textContent = String(index + 1).padStart(2, '0');
        currentActiveIndex = index;
    }

    // ── Reset wheel to initial state ──────────────────────────────
    function resetWheel() {
        gsap.set(wheelVisual, { x: ENTRANCE_X, opacity: 0 });
        gsap.set(wheelRotator, { rotation: 0 });
        wheelNodes.forEach(n => gsap.set(n.querySelector('span'), { rotation: 0 }));
        gsap.set(wheelCenter, { rotation: 0 });
        currentActiveIndex = -1;
        setActiveService(0);
    }

    // ── Initial state: wheel off-screen right ──────────────────────
    const isMobile = window.innerWidth <= 768;
    const ENTRANCE_X = isMobile ? 180 : 350;
    gsap.set(wheelVisual, { x: ENTRANCE_X, opacity: 0 });
    setActiveService(0);

    // ── Scroll budget ──────────────────────────────────────────────
    const ENTRANCE_PX   = isMobile ? 250 : 500;
    const STEP_PX       = isMobile ? 380 : 700;
    const ROTATION_PX   = STEP_PX * (TOTAL_SERVICES - 1);
    const TOTAL_SCROLL  = ENTRANCE_PX + ROTATION_PX;

    const ENTRANCE_FRAC = ENTRANCE_PX / TOTAL_SCROLL;
    const ROTATE_FRAC   = 1 - ENTRANCE_FRAC;

    // Force GPU layer on wheel elements for smooth mobile rendering
    gsap.set([wheelVisual, wheelRotator, wheelCenter], { force3D: true });
    wheelNodes.forEach(n => gsap.set(n.querySelector('span'), { force3D: true }));

    // Throttle updates on mobile to avoid overwhelming the thread
    let lastActiveIndex = -1;
    let rafId = null;

    ScrollTrigger.create({
        trigger: wheelSection,
        start: 'top top',
        end: `+=${TOTAL_SCROLL}`,
        pin: true,
        anticipatePin: 1,
        scrub: isMobile ? 1.2 : 1,
        invalidateOnRefresh: true,
        onRefresh: positionNodes,
        onLeaveBack: resetWheel,
        onUpdate: (self) => {
            if (rafId) return; // skip if a frame is already queued
            rafId = requestAnimationFrame(() => {
                rafId = null;
                const p = self.progress; // 0 → 1

                if (p <= ENTRANCE_FRAC) {
                    // ── Phase 1: wheel slides in from the right ──
                    const ep = p / ENTRANCE_FRAC;
                    const eased = gsap.parseEase('power2.out')(ep);

                    gsap.set(wheelVisual, {
                        x: ENTRANCE_X * (1 - eased),
                        opacity: Math.min(ep * 2, 1),
                        force3D: true,
                    });

                    gsap.set(wheelRotator, { rotation: 0, force3D: true });
                    wheelNodes.forEach(n => gsap.set(n.querySelector('span'), { rotation: 0, force3D: true }));
                    gsap.set(wheelCenter, { rotation: 0, force3D: true });
                    if (lastActiveIndex !== 0) { setActiveService(0); lastActiveIndex = 0; }

                } else {
                    // ── Phase 2: wheel fully visible, rotate ──
                    gsap.set(wheelVisual, { x: 0, opacity: 1, force3D: true });

                    const rp    = (p - ENTRANCE_FRAC) / ROTATE_FRAC;
                    const step  = rp * (TOTAL_SERVICES - 1);
                    const rot   = step * -ANGLE_PER_SERVICE;

                    gsap.set(wheelRotator, { rotation: rot, force3D: true });
                    wheelNodes.forEach(n => gsap.set(n.querySelector('span'), { rotation: -rot, force3D: true }));
                    gsap.set(wheelCenter, { rotation: -rot, force3D: true });

                    const activeIndex = Math.min(Math.round(step), TOTAL_SERVICES - 1);
                    if (lastActiveIndex !== activeIndex) {
                        setActiveService(activeIndex);
                        lastActiveIndex = activeIndex;
                    }
                }
            });
        }
    });

    // =========================================
    // SERVICES MOBILE — alternating slide-in cards
    // =========================================
    if (isMobile) {
        document.querySelectorAll('.sm-card').forEach(card => {
            gsap.to(card, {
                x: 0,
                opacity: 1,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: card,
                    start: 'top 88%',
                    toggleActions: 'play none none none',
                    onEnter: () => card.classList.add('is-visible'),
                },
            });
        });
    }

    // =========================================
    // MARQUEE — Infinite horizontal scroll
    // =========================================
    const marqueeTrack = document.querySelector('.marquee-track');
    if (marqueeTrack) {
        const marqueeWidth = marqueeTrack.scrollWidth / 2;
        gsap.set(marqueeTrack, { x: 0 });
        gsap.to(marqueeTrack, {
            x: -marqueeWidth,
            duration: 25,
            ease: 'none',
            repeat: -1,
        });
    }

    // =========================================
    // PARALLAX — Hero background
    // =========================================
    gsap.to('.hero__bg-image', {
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
        },
        y: 120,
        scale: 1.1,
        ease: 'none',
    });

    gsap.to('.hero__content', {
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true,
        },
        y: 80,
        ease: 'none',
    });

    // =========================================
    // WHATSAPP FLOAT — Appear after scroll
    // =========================================
    const whatsappFloat = document.querySelector('.whatsapp-float');
    gsap.set(whatsappFloat, { scale: 0, opacity: 0 });

    ScrollTrigger.create({
        start: 'top -300',
        onEnter: () => {
            gsap.to(whatsappFloat, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' });
        },
        onLeaveBack: () => {
            gsap.to(whatsappFloat, { scale: 0, opacity: 0, duration: 0.3, ease: 'power2.in' });
        },
    });

    // =========================================
    // PARTICLE SYSTEM (Hero Background)
    // =========================================
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;
    let mouseX = 0, mouseY = 0;

    function resizeCanvas() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x       = Math.random() * canvas.width;
            this.y       = Math.random() * canvas.height;
            this.size    = Math.random() * 1.5 + 0.5;
            this.speedX  = (Math.random() - 0.5) * 0.3;
            this.speedY  = (Math.random() - 0.5) * 0.3;
            this.opacity = Math.random() * 0.4 + 0.1;
            this.hue     = Math.random() > 0.7 ? 35 : 21;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                const force = (120 - dist) / 120;
                this.x -= dx * force * 0.01;
                this.y -= dy * force * 0.01;
            }
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width)  this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 100%, 50%, ${this.opacity})`;
            ctx.fill();
        }
    }

    function initParticles() {
        const count = Math.min(80, Math.floor(window.innerWidth / 15));
        particles = [];
        for (let i = 0; i < count; i++) particles.push(new Particle());
    }

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx   = particles[i].x - particles[j].x;
                const dy   = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(232,82,26,${(1 - dist / 150) * 0.12})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        drawConnections();
        animationId = requestAnimationFrame(animateParticles);
    }

    canvas.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

    initParticles();
    animateParticles();

    ScrollTrigger.create({
        trigger: '#hero',
        start: 'top bottom',
        end: 'bottom top',
        onLeave: () => cancelAnimationFrame(animationId),
        onEnterBack: () => animateParticles(),
    });

    // =========================================
    // SMOOTH SCROLL
    // =========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const top = target.getBoundingClientRect().top + window.pageYOffset - header.offsetHeight - 20;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    // =========================================
    // UTM CAPTURE
    // =========================================
    function getUtms() {
        const params = new URLSearchParams(window.location.search);
        const keys   = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
        const utms   = {};
        keys.forEach(k => { if (params.get(k)) utms[k] = params.get(k); });

        // Persiste UTMs na sessão para não perder em navegação interna
        if (Object.keys(utms).length) {
            sessionStorage.setItem('digitha_utms', JSON.stringify(utms));
        }
        const stored = sessionStorage.getItem('digitha_utms');
        return stored ? JSON.parse(stored) : {};
    }

    // =========================================
    // FORM HANDLING
    // =========================================
    const SHEET_URL = '/api/leads';

    const form = document.getElementById('contact-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name      = document.getElementById('form-name').value.trim();
        const email     = document.getElementById('form-email').value.trim();
        const phone     = document.getElementById('form-phone').value.trim();
        const nicho     = document.getElementById('form-nicho').value.trim();
        const marketing = document.getElementById('form-marketing').value;
        const message   = document.getElementById('form-message').value.trim();
        const utms      = getUtms();

        const submitBtn = document.getElementById('form-submit');
        const original  = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Enviando...';

        let success = false;
        try {
            const res = await fetch(SHEET_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, nicho, marketing, message, utms }),
            });
            success = res.ok;
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('[Digitha] Erro ao enviar lead:', res.status, err);
            }
        } catch (err) {
            console.error('[Digitha] Erro de rede:', err);
        }

        if (success) {
            submitBtn.innerHTML = '✓ Recebido! Em breve entraremos em contato.';
            submitBtn.style.background = '#25d366';
            setTimeout(() => {
                submitBtn.innerHTML = original;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
                form.reset();
            }, 4000);
        } else {
            submitBtn.innerHTML = 'Erro ao enviar. Tente novamente.';
            submitBtn.style.background = '#e53e3e';
            setTimeout(() => {
                submitBtn.innerHTML = original;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
            }, 4000);
        }
    });

    // =========================================
    // PHONE INPUT MASK
    // =========================================
    const phoneInput = document.getElementById('form-phone');
    phoneInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 6)      v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
        else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
        else if (v.length > 0) v = `(${v}`;
        e.target.value = v;
    });

    // =========================================
    // MAGNETIC BUTTONS
    // =========================================
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const r = btn.getBoundingClientRect();
            gsap.to(btn, {
                x: (e.clientX - r.left - r.width / 2) * 0.2,
                y: (e.clientY - r.top  - r.height / 2) * 0.2,
                duration: 0.3,
                ease: 'power2.out',
            });
        });
        btn.addEventListener('mouseleave', () => {
            gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        });
    });

    // =========================================
    // NAV ACTIVE STATE
    // =========================================
    document.querySelectorAll('.nav-link:not(.nav-link--cta)').forEach(link => {
        const href = link.getAttribute('href');
        if (!href || !href.startsWith('#')) return;
        const section = document.querySelector(href);
        if (!section) return;
        ScrollTrigger.create({
            trigger: section,
            start: 'top center',
            end: 'bottom center',
            onToggle: (self) => {
                if (self.isActive) {
                    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            }
        });
    });

    // =========================================
    // WORD CAROUSEL — Pilares vertical ticker
    // =========================================
    const carouselTrack = document.querySelector('.word-carousel__track');
    if (carouselTrack) {
        const words    = carouselTrack.querySelectorAll('span');
        const itemH    = () => words[0].offsetHeight;
        let   current  = 0;
        let   carousel_timer;

        function nextWord() {
            current++;
            gsap.to(carouselTrack, {
                y: -(current * itemH()),
                duration: 0.6,
                ease: 'back.inOut(1.7)',
                onComplete: () => {
                    // Último é duplicata do primeiro → reset silencioso
                    if (current >= words.length - 1) {
                        current = 0;
                        gsap.set(carouselTrack, { y: 0 });
                    }
                    carousel_timer = setTimeout(nextWord, 1500);
                },
            });
        }

        // Inicia quando a seção entra na tela
        ScrollTrigger.create({
            trigger: '.pilares',
            start: 'top 80%',
            onEnter: () => { carousel_timer = setTimeout(nextWord, 1500); },
            onLeave: () => clearTimeout(carousel_timer),
            onEnterBack: () => { carousel_timer = setTimeout(nextWord, 1500); },
            onLeaveBack: () => clearTimeout(carousel_timer),
        });
    }

    // =========================================
    // SOBRE A EMPRESA — Parallax Gallery + Counters
    // =========================================
    (function initSobreEmpresa() {
        // --- Image reveal: clip-path wipe from bottom ---
        const fotos = document.querySelectorAll('.js-sobre-foto');
        fotos.forEach((foto, i) => {
            const inner = foto.querySelector('.sobre-foto__inner');
            if (!inner) return;

            gsap.to(inner, {
                clipPath: 'inset(0% 0 0 0)',
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: foto,
                    start: 'top 95%',
                    toggleActions: 'play none none none',
                },
                delay: i * 0.08,
            });

            // Inner parallax (scale down + y drift as image scrolls through viewport)
            const imgEl = inner.querySelector('img');
            if (imgEl) {
                gsap.to(imgEl, {
                    y: -40,
                    scale: 1,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: foto,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: 1.5,
                    },
                });
            }
        });

        // --- Stagger the whole gallery items on enter ---
        gsap.from('.sobre-foto', {
            y: 60,
            opacity: 0,
            stagger: 0.12,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.sobre-empresa__gallery',
                start: 'top 95%',
                toggleActions: 'play none none none',
            },
        });

        // --- Left narrative: slide in from left ---
        gsap.from('.sobre-empresa__narrative', {
            x: -50,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.sobre-empresa__narrative',
                start: 'top 80%',
                toggleActions: 'play none none none',
            },
        });

        // --- Stats counter animation ---
        const statNums = document.querySelectorAll('[data-sobre-counter]');
        statNums.forEach(el => {
            const target = parseInt(el.dataset.sobreCounter, 10);
            const prefix = el.dataset.prefix || '';
            const suffix = el.dataset.suffix || '';
            ScrollTrigger.create({
                trigger: el,
                start: 'top 85%',
                once: true,
                onEnter: () => {
                    gsap.to({ val: 0 }, {
                        val: target,
                        duration: 1.8,
                        ease: 'power2.out',
                        onUpdate: function () {
                            el.textContent = prefix + Math.round(this.targets()[0].val) + suffix;
                        },
                    });
                },
            });
        });

        // --- Diferenciais stagger ---
        gsap.from('.sobre-diferencial', {
            y: 20,
            opacity: 0,
            stagger: 0.1,
            duration: 0.6,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: '.sobre-diferenciais',
                start: 'top 85%',
                toggleActions: 'play none none none',
            },
        });
    })();

    // =========================================
    // TEXT SCRAMBLE — Section tags on scroll
    // =========================================
    class TextScramble {
        constructor(el) {
            this.el = el;
            this.chars = '01アイウエオABCDEF!#%@<>';
            this.update = this.update.bind(this);
        }
        run() {
            const original = this.el.textContent;
            this.queue = original.split('').map((char, i) => ({
                from: char,
                to: char,
                start: Math.floor(i * 0.8),
                end: Math.floor(i * 0.8) + Math.floor(Math.random() * 8) + 4,
                char: '',
            }));
            this.frame = 0;
            cancelAnimationFrame(this.raf);
            this.update();
        }
        update() {
            let out = '';
            let done = 0;
            for (const item of this.queue) {
                if (this.frame >= item.end) {
                    done++;
                    out += item.to;
                } else if (this.frame >= item.start) {
                    if (!item.char || Math.random() < 0.3)
                        item.char = this.chars[Math.floor(Math.random() * this.chars.length)];
                    out += `<span class="scramble-char">${item.char}</span>`;
                } else {
                    out += item.from;
                }
            }
            this.el.innerHTML = out;
            if (done < this.queue.length) {
                this.frame++;
                this.raf = requestAnimationFrame(this.update);
            }
        }
    }

    document.querySelectorAll('.section-tag').forEach(tag => {
        const fx = new TextScramble(tag);
        ScrollTrigger.create({
            trigger: tag,
            start: 'top 90%',
            onEnter: () => fx.run(),
            once: true,
        });
    });

    // =========================================
    // CUSTOM CURSOR — Desktop only
    // =========================================
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouch) {
        const cursorDot  = document.createElement('div');
        const cursorRing = document.createElement('div');
        cursorDot.className  = 'cursor-dot';
        cursorRing.className = 'cursor-ring';
        document.body.appendChild(cursorDot);
        document.body.appendChild(cursorRing);

        let curX = 0, curY = 0;
        window.addEventListener('mousemove', (e) => {
            curX = e.clientX;
            curY = e.clientY;
            gsap.set(cursorDot, { x: curX, y: curY });
            gsap.to(cursorRing, { x: curX, y: curY, duration: 0.18, ease: 'power2.out' });
        });

        const interactives = document.querySelectorAll('a, button, .pilar-card, .servico-card, .wheel-node, .resultado-item');
        interactives.forEach(el => {
            el.addEventListener('mouseenter', () => {
                gsap.to(cursorRing, { scale: 2.2, borderColor: 'var(--color-accent)', duration: 0.3 });
                gsap.to(cursorDot,  { scale: 0, duration: 0.2 });
            });
            el.addEventListener('mouseleave', () => {
                gsap.to(cursorRing, { scale: 1, borderColor: 'rgba(232,82,26,0.4)', duration: 0.3 });
                gsap.to(cursorDot,  { scale: 1, duration: 0.2 });
            });
        });
    }

    // =========================================
    // 3D CARD TILT — Desktop only
    // =========================================
    if (!isTouch) {
        document.querySelectorAll('.pilar-card, .servico-card, .resultado-item').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width  - 0.5;
                const y = (e.clientY - r.top)  / r.height - 0.5;
                gsap.to(card, {
                    rotationY:  x * 10,
                    rotationX: -y * 10,
                    transformPerspective: 800,
                    ease: 'power2.out',
                    duration: 0.4,
                });
            });
            card.addEventListener('mouseleave', () => {
                gsap.to(card, { rotationX: 0, rotationY: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
            });
        });
    }

    // =========================================
    // GLITCH PULSE — Hero title
    // =========================================
    const heroTitle = document.querySelector('.hero__title');
    if (heroTitle) {
        setInterval(() => {
            if (Math.random() > 0.85) {
                heroTitle.classList.add('glitch');
                setTimeout(() => heroTitle.classList.remove('glitch'), 200);
            }
        }, 2500);
    }

    // =========================================
    // TECH COUNTERS — Scan line on enter
    // =========================================
    document.querySelectorAll('.resultado-item').forEach(item => {
        ScrollTrigger.create({
            trigger: item,
            start: 'top 85%',
            onEnter: () => item.classList.add('scan'),
            once: true,
        });
    });


    // =========================================
    // TYPING EFFECT — CTA Final title
    // =========================================
    const ctaTitle = document.getElementById('cta-typing-title');
    if (ctaTitle) {
        const plainText = 'Seu crescimento ';
        const gradientText = 'começa aqui.';

        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        cursor.textContent = '|';

        ctaTitle.textContent = '';
        ctaTitle.appendChild(cursor);

        ScrollTrigger.create({
            trigger: ctaTitle,
            start: 'top 85%',
            once: true,
            onEnter: () => {
                const textNode = document.createTextNode('');
                ctaTitle.insertBefore(textNode, cursor);
                let i = 0;

                const typePlain = setInterval(() => {
                    if (i < plainText.length) {
                        textNode.textContent += plainText[i++];
                    } else {
                        clearInterval(typePlain);
                        const gradSpan = document.createElement('span');
                        gradSpan.className = 'text-gradient';
                        ctaTitle.insertBefore(gradSpan, cursor);
                        let j = 0;
                        const typeGrad = setInterval(() => {
                            if (j < gradientText.length) {
                                gradSpan.textContent += gradientText[j++];
                            } else {
                                clearInterval(typeGrad);
                                cursor.style.display = 'none';
                            }
                        }, 65);
                    }
                }, 55);
            }
        });
    }

} // end initAnimations
