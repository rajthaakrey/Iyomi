// Main initialization
document.addEventListener('DOMContentLoaded', function () {

  // Lenis Smooth Scroll Setup
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
  });

  // Integrate with GSAP ticker for ScrollTrigger sync
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);

  // GSAP Manifesto Word Animation
  gsap.registerPlugin(ScrollTrigger);

  const headline = document.getElementById('manifesto-headline');

  const originalSpans = [...headline.querySelectorAll('span')];
  headline.innerHTML = '';

  originalSpans.forEach(span => {
    const cls = span.className;
    span.textContent.trim().split(/\s+/).forEach(word => {
      const w = document.createElement('span');
      w.className = `word ${cls}`;
      w.textContent = word + '\u00A0';
      headline.appendChild(w);
    });
  });

  const words = headline.querySelectorAll('.word');

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.manifesto-section',
      start: 'top 50%',
      end: 'top 00%',
      scrub: 0.8,
    }
  });

  tl.from(words, {
    x: () => gsap.utils.random(200, 1000),
    y: () => gsap.utils.random(-0, 0),
    rotation: () => gsap.utils.random(-0, 0),
    opacity: 0,
    ease: 'power2.out',
    stagger: {
      each: 0.04,
      from: 'start',
    }
  });

  // Dropdown Navigation Positioning
  const nav = document.querySelector('nav');
  const navGroup = document.querySelector('.nav-group');
  const panelWidth = 760;

  document.querySelectorAll('.dropdown-menu').forEach(menu => nav.appendChild(menu));

  function applyPositions() {
    const navRect = nav.getBoundingClientRect();
    const grpRect = navGroup.getBoundingClientRect();
    const grpCenter = (grpRect.left + grpRect.right) / 2 - navRect.left;
    const left = grpCenter - panelWidth / 2;
    const top = grpRect.bottom - navRect.top + 8;
    nav.querySelectorAll('.dropdown-menu').forEach(m => {
      m.style.left = left + 'px';
      m.style.top = top + 'px';
    });
  }

  applyPositions();
  window.addEventListener('resize', applyPositions);

  // Dropdown Hover Behavior
  const items = document.querySelectorAll('.nav-item.dropdown');
  const menus = nav.querySelectorAll('.dropdown-menu');
  let closeTimer = null;

  function showMenu(item, menu) {
    clearTimeout(closeTimer);
    menus.forEach(m => {
      m.style.opacity = '0';
      m.style.visibility = 'hidden';
      m.style.pointerEvents = 'none';
      m.style.transform = 'translateY(6px)';
    });
    items.forEach(it => it.classList.remove('is-open'));
    menu.style.opacity = '1';
    menu.style.visibility = 'visible';
    menu.style.pointerEvents = 'auto';
    menu.style.transform = 'translateY(0)';
    item.classList.add('is-open');
  }

  function scheduleHide() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      menus.forEach(m => {
        m.style.opacity = '0';
        m.style.visibility = 'hidden';
        m.style.pointerEvents = 'none';
        m.style.transform = 'translateY(6px)';
      });
      items.forEach(it => it.classList.remove('is-open'));
    }, 150);
  }

  items.forEach((item, i) => {
    const menu = menus[i];
    if (!menu) return;
    item.addEventListener('mouseenter', () => showMenu(item, menu));
    item.addEventListener('mouseleave', () => scheduleHide());
    menu.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    menu.addEventListener('mouseleave', () => scheduleHide());
  });

  // Video Lag Optimization and Ambient Glow Effect
  const video = document.getElementById('frameVideo');
  const canvas = document.getElementById('ambientCanvas');
  const section = document.querySelector('.frame-section');
  const frameInner = document.querySelector('.frame-inner');

  if (video && canvas && section && frameInner) {
    
    // Force hardware acceleration
    video.style.transform = 'translateZ(0)';
    video.style.backfaceVisibility = 'hidden';
    
    // Optimize video loading
    video.preload = 'metadata';
    video.setAttribute('disableRemotePlayback', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    
    // Throttle ambient sampling to reduce CPU load
    const ctx = canvas.getContext('2d');
    canvas.width = 32;
    canvas.height = 18;
    
    let samplingActive = true;
    let lastSampleTime = 0;
    const sampleInterval = 100;
    
    function sampleRegion(data, x1, y1, x2, y2, w) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2];
          count++;
        }
      }
      return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
    }
    
    function sampleAmbient() {
      if (!samplingActive) return;
      if (video.paused || video.ended || video.readyState < 2) return;
      
      const now = performance.now();
      if (now - lastSampleTime < sampleInterval) return;
      lastSampleTime = now;
      
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        
        const [tr, tg, tb] = sampleRegion(data, 0, 0, canvas.width, 3, canvas.width);
        const [br, bg, bb] = sampleRegion(data, 0, canvas.height - 3, canvas.width, canvas.height, canvas.width);
        const [lr, lg, lb] = sampleRegion(data, 0, 0, 4, canvas.height, canvas.width);
        const [rr, rg, rb] = sampleRegion(data, canvas.width - 4, 0, canvas.width, canvas.height, canvas.width);
        
        section.style.setProperty('--amb-t-r', tr);
        section.style.setProperty('--amb-t-g', tg);
        section.style.setProperty('--amb-t-b', tb);
        
        section.style.setProperty('--amb-b-r', br);
        section.style.setProperty('--amb-b-g', bg);
        section.style.setProperty('--amb-b-b', bb);
        
        section.style.setProperty('--amb-l-r', lr);
        section.style.setProperty('--amb-l-g', lg);
        section.style.setProperty('--amb-l-b', lb);
        
        section.style.setProperty('--amb-r-r', rr);
        section.style.setProperty('--amb-r-g', rg);
        section.style.setProperty('--amb-r-b', rb);
      } catch (e) {
        // Silent fail
      }
    }
    
    // Lazy load video - only play when visible
    let videoObserver = null;
    let animationFrameId = null;
    
    function startAmbientLoop() {
      if (animationFrameId) return;
      function loop() {
        sampleAmbient();
        if (samplingActive) {
          animationFrameId = requestAnimationFrame(loop);
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    }
    
    function stopAmbientLoop() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
    
    // Intersection Observer for video visibility
    if ('IntersectionObserver' in window) {
      videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            samplingActive = true;
            video.play().catch(e => console.log('Video play prevented:', e));
            startAmbientLoop();
          } else {
            samplingActive = false;
            video.pause();
            stopAmbientLoop();
          }
        });
      }, { threshold: 0.1 });
      
      videoObserver.observe(video);
    } else {
      // Fallback for older browsers
      video.play();
      startAmbientLoop();
    }
    
    // Handle page visibility to save resources
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (videoObserver && videoObserver.takeRecords) {
          video.pause();
          stopAmbientLoop();
        }
      } else {
        if (videoObserver && videoObserver.takeRecords) {
          const rect = video.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            video.play();
            startAmbientLoop();
          }
        }
      }
    });
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      if (videoObserver) videoObserver.disconnect();
      stopAmbientLoop();
    });
  }
  
  // Additional CSS injection for video smoothness
  const style = document.createElement('style');
  style.textContent = `
    .frame-video {
      will-change: transform;
      transform: translateZ(0);
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .frame-section {
      contain: layout style paint;
    }
  `;
  document.head.appendChild(style);
  
});