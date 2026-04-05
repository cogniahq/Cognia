import type { Variants } from "framer-motion"

const MOTION_EASE = [0.22, 1, 0.36, 1] as const
const PAGE_REVEAL_Y = 22
const SECTION_REVEAL_Y = 20

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: PAGE_REVEAL_Y,
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.48,
      ease: MOTION_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: 14,
    scale: 0.998,
    transition: {
      duration: 0.24,
      ease: MOTION_EASE,
    },
  },
}

export const fadeUpVariants: Variants = {
  initial: {
    opacity: 0,
    y: SECTION_REVEAL_Y,
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.46,
      ease: MOTION_EASE,
    },
  },
}

export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

export const tabContentVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.998,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.32,
      ease: MOTION_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.998,
    transition: {
      duration: 0.2,
      ease: MOTION_EASE,
    },
  },
}

export const scaleInVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: MOTION_EASE,
    },
  },
}
