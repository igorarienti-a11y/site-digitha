/* =============================================
   DÍGITHA LANDING PAGE — GSAP v3
   Services Wheel with ScrollTrigger Pin + Entrance + Rotation
   ============================================= */

gsap.registerPlugin(ScrollTrigger);

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
    // SECTION FADE-UP — Scroll triggered
    // =========================================
    gsap.utils.toArray('[data-gsap="fade-up"]').forEach(el => {
        gsap.from(el, {
            scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none none',
            },
            opacity: 0,
            y: 50,
            duration: 0.8,
            ease: 'power3.out',
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
        gsap.set(cards, { opacity: 0, y: 60, scale: 0.95 });
        ScrollTrigger.create({
            trigger: cards[0].parentElement,
            start: 'top 80%',
            onEnter: () => {
                gsap.to(cards, {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.7,
                    stagger: 0.12,
                    ease: 'back.out(1.2)',
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
    const wheelLines    = document.querySelectorAll('.wheel-line');

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

        // Draw connection lines from center to each node
        const svgSize = 700; // matches viewBox
        const svgScale = svgSize / size;
        wheelLines.forEach((line, i) => {
            const deg = 180 + i * ANGLE_PER_SERVICE;
            const rad = deg * Math.PI / 180;
            const nx  = (cx + radius * Math.cos(rad)) * svgScale;
            const ny  = (cy + radius * Math.sin(rad)) * svgScale;
            line.setAttribute('x1', cx * svgScale);
            line.setAttribute('y1', cy * svgScale);
            line.setAttribute('x2', nx);
            line.setAttribute('y2', ny);
        });
    }

    positionNodes();
    window.addEventListener('resize', () => { positionNodes(); ScrollTrigger.refresh(); });

    // ── Switch active service ──────────────────────────────────────
    function setActiveService(index) {
        if (index === currentActiveIndex && index !== 0) return;

        wheelPanels.forEach((p, i) => p.classList.toggle('active', i === index));
        wheelNodes.forEach((n, i)  => n.classList.toggle('active', i === index));
        wheelDots.forEach((d, i)   => d.classList.toggle('active', i === index));

        wheelLines.forEach((l, i) => {
            if (i === index) {
                l.setAttribute('stroke', 'rgba(0,229,255,0.6)');
                l.setAttribute('stroke-width', '2');
            } else {
                l.setAttribute('stroke', 'rgba(0,229,255,0.15)');
                l.setAttribute('stroke-width', '1');
            }
        });

        wheelCounter.textContent = String(index + 1).padStart(2, '0');
        currentActiveIndex = index;
    }

    // ── Initial state: wheel off-screen right ──────────────────────
    gsap.set(wheelVisual, { x: 350, opacity: 0 });
    setActiveService(0);

    // ── Scroll budget ──────────────────────────────────────────────
    const ENTRANCE_PX   = 500;                              // px used for slide-in
    const ROTATION_PX   = 700 * (TOTAL_SERVICES - 1);      // 700px per service step
    const TOTAL_SCROLL  = ENTRANCE_PX + ROTATION_PX;       // total pinned scroll

    const ENTRANCE_FRAC = ENTRANCE_PX / TOTAL_SCROLL;      // 0–entrance_frac → slide in
    const ROTATE_FRAC   = 1 - ENTRANCE_FRAC;               // remainder → rotate

    ScrollTrigger.create({
        trigger: wheelSection,
        start: 'top top',
        end: `+=${TOTAL_SCROLL}`,
        pin: true,
        scrub: 1,           // 1s smoothing for fluid feel
        onUpdate: (self) => {
            const p = self.progress; // 0 → 1

            if (p <= ENTRANCE_FRAC) {
                // ── Phase 1: wheel slides in from the right ──
                const ep = p / ENTRANCE_FRAC;               // 0 → 1 within entrance
                const eased = gsap.parseEase('power2.out')(ep);

                gsap.set(wheelVisual, {
                    x: 350 * (1 - eased),
                    opacity: Math.min(ep * 2, 1),           // fade in quickly
                });

                // Keep rotation at 0 and first service active
                gsap.set(wheelRotator, { rotation: 0 });
                wheelNodes.forEach(n => gsap.set(n.querySelector('span'), { rotation: 0 }));
                gsap.set(wheelCenter, { rotation: 0 });
                setActiveService(0);

            } else {
                // ── Phase 2: wheel fully visible, rotate ──
                gsap.set(wheelVisual, { x: 0, opacity: 1 });

                const rp    = (p - ENTRANCE_FRAC) / ROTATE_FRAC;          // 0 → 1
                const step  = rp * (TOTAL_SERVICES - 1);                   // 0 → 5
                const rot   = step * -ANGLE_PER_SERVICE;                   // 0 → -300°

                // Rotate the wheel disc
                gsap.set(wheelRotator, { rotation: rot });

                // Counter-rotate each node label and the center logo so they stay upright
                wheelNodes.forEach(n => gsap.set(n.querySelector('span'), { rotation: -rot }));
                gsap.set(wheelCenter, { rotation: -rot });

                const activeIndex = Math.min(Math.round(step), TOTAL_SERVICES - 1);
                setActiveService(activeIndex);
            }
        }
    });

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
            scrub: 1,
        },
        y: 80,
        opacity: 0.3,
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
            this.hue     = Math.random() > 0.7 ? 280 : 187;
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
                    ctx.strokeStyle = `rgba(0,229,255,${(1 - dist / 150) * 0.12})`;
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
    // FORM HANDLING
    // =========================================
    const form = document.getElementById('contact-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name    = document.getElementById('form-name').value;
        const email   = document.getElementById('form-email').value;
        const phone   = document.getElementById('form-phone').value;
        const revenue = document.getElementById('form-revenue').value;

        const message = encodeURIComponent(
            `Olá! Vim pelo site da Dígitha.\n\n` +
            `📌 Nome: ${name}\n📧 Email: ${email}\n📱 Telefone: ${phone}\n💰 Faturamento: ${revenue}\n\n` +
            `Gostaria de agendar uma análise gratuita!`
        );
        window.open(`https://wa.me/5548999127745?text=${message}`, '_blank');

        const submitBtn = document.getElementById('form-submit');
        const original  = submitBtn.innerHTML;
        submitBtn.innerHTML = '✓ Enviado! Redirecionando...';
        submitBtn.style.background = 'var(--color-whatsapp)';
        setTimeout(() => { submitBtn.innerHTML = original; submitBtn.style.background = ''; form.reset(); }, 3000);
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

} // end initAnimations
