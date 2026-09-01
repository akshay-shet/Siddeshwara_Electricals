"use client";

import { useState, useEffect } from "react";

type Entry = { title: string; description: string; images: string[] };

type ProjectCardProps = {
  entry: Entry;
  index: number;
  type: "company" | "works";
};

const fallbackImage =
  "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=85";

const ProjectCard = ({ entry, index, type }: ProjectCardProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const safeImages = Array.isArray(entry.images) ? entry.images.filter(Boolean) : [];

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [entry.title, entry.description, safeImages.length]);

  useEffect(() => {
    if (safeImages.length <= 1) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setCurrentImageIndex((prevIndex) =>
        prevIndex === safeImages.length - 1 ? 0 : prevIndex + 1
      );
    }, 3000);

    return () => window.clearInterval(interval);
  }, [safeImages]);

  const imageUrl =
    safeImages.length > 0 ? safeImages[currentImageIndex] : fallbackImage;

  return (
    <article className="project-card">
      <div className="project-image">
        <img
          src={imageUrl}
          alt={entry.title || "Project image"}
          loading="lazy"
        />
        <span>{String(index + 1).padStart(2, "0")}</span>
        <a href="#contact" aria-label={`Enquire about ${entry.title}`}>
          ↗
        </a>
      </div>
      <p>{type === "works" ? entry.description || "Project" : entry.title}</p>
      <h3>{type === "works" ? entry.title : entry.description || "Company entry"}</h3>
    </article>
  );
};

export default ProjectCard;