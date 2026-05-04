"use client";

import React from "react";

import { AnimatedSection } from "@/components/shared/site-motion";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export const Section: React.FC<SectionProps> = ({
  children,
  className = "",
  animate = true,
}) => {
  return (
    <AnimatedSection
      className={`py-16 ${className}`}
      initial={animate ? "initial" : false}
      whileInView={animate ? "animate" : undefined}
      viewport={animate ? { once: true, amount: 0.16 } : undefined}
    >
      <div className="max-w-7xl mx-auto px-8">{children}</div>
    </AnimatedSection>
  );
};
