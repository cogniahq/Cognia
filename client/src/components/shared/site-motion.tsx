import type { ReactNode } from "react"
import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "framer-motion"

import { cn } from "@/lib/utils.lib"

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

type AnimatedPageProps = HTMLMotionProps<"div"> & {
  children: ReactNode
}

export function AnimatedPage({
  children,
  className,
  ...props
}: AnimatedPageProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={cn("min-h-screen", className)}
      initial={reduceMotion ? false : "initial"}
      animate="animate"
      exit={reduceMotion ? undefined : "exit"}
      variants={pageVariants}
      {...props}
    >
      {children}
    </motion.div>
  )
}

type AnimatedSectionProps = HTMLMotionProps<"section"> & {
  children: ReactNode
}

export function AnimatedSection({
  children,
  className,
  ...props
}: AnimatedSectionProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.section
      className={className}
      initial={reduceMotion ? false : "initial"}
      whileInView="animate"
      viewport={{ once: true, amount: 0.16 }}
      variants={fadeUpVariants}
      {...props}
    >
      {children}
    </motion.section>
  )
}

type AnimatedStaggerProps = HTMLMotionProps<"div"> & {
  children: ReactNode
}

export function AnimatedStagger({
  children,
  className,
  ...props
}: AnimatedStaggerProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : "initial"}
      whileInView="animate"
      viewport={{ once: true, amount: 0.16 }}
      variants={staggerContainerVariants}
      {...props}
    >
      {children}
    </motion.div>
  )
}
