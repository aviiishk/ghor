import {
  Bookmark,
  GraduationCap,
  Map,
  MessageCircle,
  ShieldCheck,
  Timer
} from "lucide-react";
import type { Feature, Step, Testimonial } from "@/types/site";

export const features: Feature[] = [
  {
    icon: ShieldCheck,
    title: "Verified Listings",
    description: "No fake rooms, repeated posts, or unclear owner details."
  },
  {
    icon: MessageCircle,
    title: "Direct Owner Chat",
    description: "Talk instantly with owners before planning a visit."
  },
  {
    icon: Map,
    title: "Smart Search",
    description: "Find rooms and PGs around the areas you actually prefer."
  },
  {
    icon: Bookmark,
    title: "Save Favorites",
    description: "Bookmark promising rooms and compare them later."
  },
  {
    icon: Timer,
    title: "Move Faster",
    description: "Spend less time calling and more time choosing."
  },
  {
    icon: GraduationCap,
    title: "Student Friendly",
    description: "Built around Guwahati students, interns, and first-job movers."
  }
];

export const steps: Step[] = [
  {
    title: "Browse Rooms",
    description: "Explore verified rooms and PGs by area, budget, and move-in needs."
  },
  {
    title: "Chat Owners",
    description: "Ask questions, confirm availability, and schedule visits directly."
  },
  {
    title: "Move In",
    description: "Shortlist faster and move into a place that matches your life."
  }
];

export const testimonials: Testimonial[] = [
  {
    name: "Ananya Deka",
    role: "Student",
    quote:
      "Finding a PG near college usually means calling everyone. GHOR feels like the missing shortcut."
  },
  {
    name: "Rohit Baruah",
    role: "Working Professional",
    quote:
      "I want clean listings, owner replies, and less uncertainty before I visit. This is exactly that."
  },
  {
    name: "Madhurima Saikia",
    role: "PG Owner",
    quote:
      "A focused waitlist for Guwahati renters would help owners reach serious tenants faster."
  }
];
