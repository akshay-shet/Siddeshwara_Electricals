"use client";

type Entry = { title: string; description: string; images: string[] };

type ProjectCardProps = {
  entry: Entry;
  index: number;
  type: "company" | "works";
  onOpen: (entry: Entry, entryType: "company" | "works") => void;
};

const fallbackImage =
  "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=85";

const ProjectCard = ({ entry, index, type, onOpen }: ProjectCardProps) => {
  const safeImages = Array.isArray(entry.images) ? entry.images.filter(Boolean) : [];
  const imageUrl = safeImages.length > 0 ? safeImages[0] : fallbackImage;

  return (
    <article className="project-card">
      <button
        type="button"
        className="project-image project-image-button"
        onClick={() => onOpen(entry, type)}
        aria-label={`View images for ${entry.title || "project"}`}
      >
        <img
          src={imageUrl}
          alt={entry.title || "Project image"}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
        <span>{String(index + 1).padStart(2, "0")}</span>
        <a href="#contact" aria-label={`Enquire about ${entry.title}`} onClick={(event) => event.stopPropagation()}>
          ↗
        </a>
      </button>
      <p>{type === "works" ? entry.description || "Project" : entry.title}</p>
      <h3>{type === "works" ? entry.title : entry.description || "Company entry"}</h3>
    </article>
  );
};

export default ProjectCard;