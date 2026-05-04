"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";
import {
  fadeUpVariants,
  pageVariants,
  staggerContainerVariants,
} from "@/components/shared/site-motion-variants";

type AnimatedPageProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
};

export function AnimatedPage({
  children,
  className,
  ...props
}: AnimatedPageProps) {
  const reduceMotion = useReducedMotion();

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
  );
}

type AnimatedSectionProps = HTMLMotionProps<"section"> & {
  children: ReactNode;
};

export function AnimatedSection({
  children,
  className,
  ...props
}: AnimatedSectionProps) {
  const reduceMotion = useReducedMotion();

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
  );
}

type AnimatedStaggerProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
};

export function AnimatedStagger({
  children,
  className,
  ...props
}: AnimatedStaggerProps) {
  const reduceMotion = useReducedMotion();

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
  );
}
