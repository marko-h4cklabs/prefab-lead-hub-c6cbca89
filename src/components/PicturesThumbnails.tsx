import { useState } from "react";
import ImageLightbox from "./ImageLightbox";

interface PicturesThumbnailsProps {
  urls: string[];
}

const PicturesThumbnails = ({ urls }: PicturesThumbnailsProps) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!urls || urls.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-1">
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setLightboxUrl(url)}
            className="w-14 h-14 rounded-sm overflow-hidden border border-border hover:border-accent transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <img
              src={url}
              alt={`Picture ${i + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  );
};

export default PicturesThumbnails;
