
import { useState } from "react";
import Devu from "../common/Devu";
import "./AvatarPicker.css";

const colors = ["Blue", "Red", "Yellow", "Green"];

const mascots = ["blue", "red", "yellow", "green"].flatMap((color) =>
  Array.from({ length: 12 }, (_, index) => ({
    color,
    number: index + 1,
  }))
);

function AvatarPicker({ selectedAvatar, onSelect }) {
  const [activeColor, setActiveColor] = useState("Blue");

  const filteredMascots = mascots.filter(
    (mascot) => mascot.color === activeColor.toLowerCase()
  );

  return (
    <div className="avatar-picker">
      <div className="avatar-filters">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={`avatar-filter ${
              activeColor === color ? "active" : ""
            }`}
            onClick={() => setActiveColor(color)}
            aria-pressed={activeColor === color}
          >
            {color}
          </button>
        ))}
      </div>

      <div className="avatar-grid">
        {filteredMascots.map((mascot) => {
          const isSelected =
            selectedAvatar?.color === mascot.color &&
            selectedAvatar?.number === mascot.number;

          return (
            <button
              key={`${mascot.color}-${mascot.number}`}
              type="button"
              className={`avatar-option ${
                isSelected ? "selected" : ""
              }`}
              onClick={() => onSelect(mascot)}
              aria-label={`Select ${mascot.color} Devu ${mascot.number}`}
              aria-pressed={isSelected}
            >
              <Devu
                color={mascot.color}
                number={mascot.number}
                size={85}
              />

              {isSelected && (
                <span className="avatar-check">✓</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="avatar-count">
        Showing {filteredMascots.length} mascots
      </p>
    </div>
  );
}

export default AvatarPicker;
