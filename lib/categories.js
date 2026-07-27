import {
  Landmark,
  MapPin,
  BedDouble,
  Ticket,
  TrainFront,
  UtensilsCrossed,
} from "lucide-react";

// One icon set across the whole app. These were emoji until now, which meant
// a category chip put 🏛️ directly beside a lucide wallet and a lucide clock -
// two different drawing conventions inside one row - and emoji render
// differently on every OS, so the app didn't even control how they looked.
// lucide was already the only icon dependency; now it's the only icon.
export const CATEGORIES = {
  food: { label: "Food", Icon: UtensilsCrossed },
  sightseeing: { label: "Sightseeing", Icon: Landmark },
  lodging: { label: "Lodging", Icon: BedDouble },
  transport: { label: "Transport", Icon: TrainFront },
  activity: { label: "Activity", Icon: Ticket },
  other: { label: "Other", Icon: MapPin },
};

// Plain text, for the places that need a string rather than a component:
// select options, aria-labels, and anywhere a category is read aloud.
export const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([key, { label }]) => [key, label]),
);

export function categoryIcon(category) {
  return CATEGORIES[category]?.Icon ?? MapPin;
}
