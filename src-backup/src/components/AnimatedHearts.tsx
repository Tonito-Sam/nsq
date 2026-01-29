import React from "react";

interface AnimatedHeartsProps {
  hearts: number[];
}

export const AnimatedHearts: React.FC<AnimatedHeartsProps> = ({ hearts }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {hearts.map((id, index) => (
        <div
          key={id}
          className="absolute right-8 bottom-32 text-3xl animate-float-heart"
          style={{
            animationDuration: "2s",
            animationDelay: `${index * 0.1}s`,
            right: `${20 + (index % 3) * 20}px`,
          }}
        >
          ❤️
        </div>
      ))}
    </div>
  );
};