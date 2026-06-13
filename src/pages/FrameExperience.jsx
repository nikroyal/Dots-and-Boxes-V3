import { useLocation } from 'react-router-dom';

export default function FrameExperience({ experience }) {
  const location = useLocation();

  if (!experience?.frameSrc) {
    return (
      <div className="fade-in text-center py-20 px-4">
        <div className="font-display text-3xl mb-3">Experience unavailable</div>
        <p className="font-display text-sm opacity-60 max-w-md mx-auto">
          This Axiom thing is missing its launch target.
        </p>
      </div>
    );
  }

  const frameSrc = `${experience.frameSrc}${location.hash || ''}`;

  return (
    <div className="h-full min-h-[560px] bg-black fade-in">
      <iframe
        key={frameSrc}
        src={frameSrc}
        title={experience.name}
        className="block w-full h-full min-h-[560px] border-0"
        allow="fullscreen; clipboard-write"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
