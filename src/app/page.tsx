"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore, useCallback, useRef } from "react";
import { type Catalog, type Entry, emptyCatalog, normalizeCatalog } from "@/lib/catalog";
import ProjectCard from "./components/ProjectCard";

type StoryEntry = {
  title: string;
  description: string;
  images: string[];
  type: "company" | "works";
};

const mapUrl = "https://www.google.com/maps/place/13%C2%B002'10.4%22N+77%C2%B029'45.2%22E/@13.035287,77.4965696,17.67z/data=!4m4!3m3!8m2!3d13.036232!4d77.4958878?hl=en&entry=ttu";
const mapEmbedUrl = "https://www.google.com/maps?q=13.036232,77.4958878&z=17&output=embed";

const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("siddeshwara-catalog-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("siddeshwara-catalog-change", callback);
  };
};

export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [story, setStory] = useState<StoryEntry | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const catalogCacheRef = useRef<{ raw: string | null; parsed: Catalog } | null>(null);

  const getCatalogSnapshotMemo = useCallback(() => {
    if (typeof window === "undefined") return emptyCatalog;

    if (!catalogCacheRef.current) {
      const stored = localStorage.getItem("siddeshwara-catalog");
      const parsed = stored ? normalizeCatalog(JSON.parse(stored)) : emptyCatalog;
      catalogCacheRef.current = { raw: stored, parsed };
      return parsed;
    }

    const stored = localStorage.getItem("siddeshwara-catalog");
    if (stored === catalogCacheRef.current.raw) {
      return catalogCacheRef.current.parsed;
    }

    const parsed = stored ? normalizeCatalog(JSON.parse(stored)) : emptyCatalog;
    catalogCacheRef.current = { raw: stored, parsed };
    return parsed;
  }, []);

  const getServerCatalogSnapshotMemo = useCallback(() => emptyCatalog, []);
  const catalog = useSyncExternalStore(subscribe, getCatalogSnapshotMemo, getServerCatalogSnapshotMemo);

  useEffect(() => {
    const syncFromDatabase = async () => {
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const nextCatalog = normalizeCatalog(await response.json());
        localStorage.setItem("siddeshwara-catalog", JSON.stringify(nextCatalog));
        window.dispatchEvent(new Event("siddeshwara-catalog-change"));
      } catch (error) {
        console.warn("Unable to sync catalog from MongoDB:", error);
      }
    };

    const scheduleSync = () => {
      const runner = () => {
        void syncFromDatabase();
      };

      const timeout = window.setTimeout(runner, 120);
      return () => window.clearTimeout(timeout);
    };

    const cleanup = scheduleSync();

    const onFocus = () => {
      void syncFromDatabase();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void syncFromDatabase();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onFocus);

    return () => {
      cleanup();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onFocus);
    };
  }, []);

  useEffect(() => {
    const media = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    const updateMotionPreference = () => {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      setReduceMotion(Boolean(media?.matches) || isMobile);
    };

    updateMotionPreference();

    media?.addEventListener?.("change", updateMotionPreference);
    window.addEventListener("resize", updateMotionPreference, { passive: true });

    return () => {
      media?.removeEventListener?.("change", updateMotionPreference);
      window.removeEventListener("resize", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setScrollY(0);
      return undefined;
    }

    let frameId = 0;

    const onScroll = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        frameId = 0;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [reduceMotion]);

  const orbitOneStyle = reduceMotion ? { transform: "rotate(0deg)" } : { transform: `rotate(${scrollY * 0.12}deg)` };
  const orbitTwoStyle = reduceMotion ? { transform: "rotate(0deg)" } : { transform: `rotate(${-scrollY * 0.18}deg)` };
  const energyCoreStyle = reduceMotion
    ? { transform: "translateY(0px) rotateX(0deg) rotateY(0deg)" }
    : { transform: `translateY(${scrollY * 0.08}px) rotateX(${scrollY * 0.04}deg) rotateY(${scrollY * 0.05}deg)` };

  const openStory = (entry: Entry, entryType: "company" | "works") => {
    const safeImages = Array.isArray(entry.images) ? entry.images.filter(Boolean) : [];
    const images = safeImages.length > 0 ? safeImages : ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=85"];

    setStory({
      title: entry.title,
      description: entry.description,
      images,
      type: entryType,
    });
    setStoryIndex(0);
  };

  const closeStory = () => {
    setStory(null);
    setStoryIndex(0);
  };

  const showPrevious = () => {
    if (!story) {
      return;
    }
    setStoryIndex((current) => (current === 0 ? story.images.length - 1 : current - 1));
  };

  const showNext = () => {
    if (!story) {
      return;
    }
    setStoryIndex((current) => (current === story.images.length - 1 ? 0 : current + 1));
  };

  useEffect(() => {
    if (!story) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeStory();
      }
      if (event.key === "ArrowLeft") {
        showPrevious();
      }
      if (event.key === "ArrowRight") {
        showNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [story]);

  return (
    <main className="landing-page">
      <nav className="nav-shell">
        <div className="page-shell nav-inner">
          <a className="brand" href="#top" aria-label="Siddeshwara Electricals home">
            <Image className="logo-image" src="/logo.png" alt="Siddeshwara Electricals logo" width={72} height={48} priority />
            <span className="brand-name">
              <span>Siddeshwara</span>
              <em>Electricals</em>
            </span>
          </a>

          <div className="nav-links">
            <a href="#company">Company</a>
            <a href="#works">Works</a>
            <a href="#contact">Contact</a>
          </div>

          <div className="nav-tools">
            <a className="nav-action" href="#contact">Start a conversation <span>↗</span></a>
          </div>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="page-shell hero-inner">
          <div className="hero-copy">
            <p className="eyebrow headline-kicker">Built for critical environments</p>
            <h1>Powering<br /><span>precision.</span></h1>
            <p className="hero-intro">Electrical and lighting systems for the places where every detail matters.</p>
            <div className="hero-metrics" aria-label="Highlights">
              <div><strong>12+</strong><span>Years in field</span></div>
              <div><strong>24/7</strong><span>Operational focus</span></div>
              <div><strong>Built</strong><span>For critical spaces</span></div>
              <div><strong>Tailored</strong><span>Project delivery</span></div>
            </div>
            <a className="text-link" href="#works">Explore our work <span>↓</span></a>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-one" style={orbitOneStyle} />
            <div className="orbit orbit-two" style={orbitTwoStyle} />
            <div className="energy-core" style={energyCoreStyle}>
              <div className="core-face face-front">ϟ</div>
              <div className="core-face face-side" />
              <div className="core-face face-top" />
            </div>
          </div>
        </div>
      </section>

      <section className="company-section" id="company">
        <div className="page-shell section-shell">
          <div className="section-grid company-heading">
            <div className="section-kicker"><span>01</span><span>THE COMPANY</span></div>
            <div>
              <h2>Quietly capable.<br /><i>Precisely delivered.</i></h2>
            </div>
          </div>

          <div className="project-grid">
            {catalog.company.map((entry: Entry, index: number) => (
              <ProjectCard key={`${entry.title}-${index}`} entry={entry} index={index} type="company" onOpen={openStory} />
            ))}
          </div>
        </div>
      </section>

      <section className="services-section">
        <div className="page-shell section-shell services-wrap">
          <div className="services-intro">
            <p className="eyebrow">What we do</p>
            <h2>Infrastructure<br />with intent.</h2>
          </div>
          <div className="service-list">
            <div><span>01</span><h3>Electrical contracting</h3><p>End-to-end power distribution, installation, and commissioning for demanding industrial environments.</p></div>
            <div><span>02</span><h3>Architectural lighting</h3><p>Efficient, considered lighting systems that make complex spaces safer and more human.</p></div>
            <div><span>03</span><h3>Pharma facilities</h3><p>Reliable electrical infrastructure shaped around compliance, continuity, and clean operations.</p></div>
          </div>
        </div>
      </section>

      <section className="works-section" id="works">
        <div className="page-shell section-shell">
          <div className="section-grid works-heading">
            <div className="section-kicker"><span>02</span><span>SELECTED WORKS</span></div>
            <div>
              <h2>Made to hold<br /><i>the pressure.</i></h2>
            </div>
          </div>

          <div className="project-grid">
            {catalog.works.map((entry: Entry, index: number) => (
              <ProjectCard key={`${entry.title}-${index}`} entry={entry} index={index} type="works" onOpen={openStory} />
            ))}
          </div>
        </div>
      </section>

      {story && (
        <div
          className="story-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${story.title || "Project"} gallery`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeStory();
            }
          }}
        >
          <div className="story-panel">
            <div className="story-header">
              <button type="button" className="story-back" onClick={closeStory}>
                ← Back to home
              </button>
              <span className="story-counter">
                {String(storyIndex + 1).padStart(2, "0")} / {String(story.images.length).padStart(2, "0")}
              </span>
            </div>

            <div className="story-stage">
              <button type="button" className="story-nav story-prev" onClick={showPrevious} aria-label="Previous image">
                ←
              </button>
              <img
                src={story.images[storyIndex]}
                alt={`${story.title || "Project"} view ${storyIndex + 1}`}
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
              <button type="button" className="story-nav story-next" onClick={showNext} aria-label="Next image">
                →
              </button>
            </div>

            <div className="story-footer">
              <div>
                <p>{story.type === "works" ? story.description || "Project" : story.title}</p>
                <h3>{story.type === "works" ? story.title : story.description || "Company entry"}</h3>
              </div>
              <a href="#contact" className="story-contact" onClick={closeStory}>Enquire</a>
            </div>
          </div>
        </div>
      )}

      <section className="location-section" id="contact">
        <div className="page-shell contact-shell">
          <a className="location-map" href={mapUrl} target="_blank" rel="noreferrer" aria-label="Open Siddeshwara Electricals location in Google Maps">
            <iframe src={mapEmbedUrl} title="Siddeshwara Electricals location on Google Maps" loading="lazy" />
            <div className="map-shade" />
            <div className="map-pin">+</div>
            <div className="map-caption">Siddeshwara Electricals<br /><span>Bengaluru, Karnataka</span></div>
            <span className="map-open">Open in Google Maps ↗</span>
          </a>

          <div className="contact-panel">
            <p className="eyebrow">Find us / talk to us</p>
            <h2>Let&apos;s make<br /><i>something work.</i></h2>
            <p>Have a facility, project, or question in mind? We&apos;d like to hear about it.</p>
            <div className="contact-actions">
              <a className="contact-number" href="tel:+918618980491">+91 86189 80491 <span>↗</span></a>
              <a className="whatsapp" href="https://wa.me/918618980491" target="_blank" rel="noreferrer">
                <svg className="whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.7 11.7 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.6 4.1 1.6 5.8L.2 24l6.6-1.7a11.8 11.8 0 0 0 5.3 1.3h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.2-6.1-3.5-8.3ZM12.1 21.6h-.1c-1.7 0-3.3-.5-4.8-1.3l-.3-.2-3.9 1 1-3.8-.2-.3a9.8 9.8 0 0 1-1.5-5.2C2.3 6.4 6.7 2 12.1 2c2.6 0 5.1 1 6.9 2.9a9.7 9.7 0 0 1 2.9 6.9c0 5.4-4.4 9.8-9.8 9.8Zm5.4-7.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.8-2.8-1.5-3.9-3.4-.3-.5.3-.5.8-1.7.1-.2.1-.4 0-.6-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.8 5.1 2.2.9 2.7.7 3.2.7.5 0 1.7-.7 1.9-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" /></svg>
                WhatsApp us <span>↗</span>
              </a>
            </div>
            <a className="address" href={mapUrl} target="_blank" rel="noreferrer">13°02&apos;10.4&quot;N 77°29&apos;45.2&quot;E<br /><span>Open in Google Maps ↗</span></a>
          </div>
        </div>
      </section>

      <footer>
        <div className="page-shell footer-inner">
          <a className="brand" href="#top">
            <Image className="logo-image footer-logo" src="/logo.png" alt="Siddeshwara Electricals logo" width={58} height={39} />
            <span className="brand-name">
              <span>Siddeshwara</span>
              <em>Electricals</em>
            </span>
          </a>
          <span>© 2026 Siddeshwara Electricals</span>
        </div>
      </footer>
    </main>
  );
}
