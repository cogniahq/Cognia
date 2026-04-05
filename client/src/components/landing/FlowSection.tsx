import React, { useMemo } from "react"
import { motion } from "framer-motion"

import { AnimatedStagger } from "@/components/shared/site-motion"
import { fadeUpVariants } from "@/components/shared/site-motion-variants"

import { Section } from "./Section"

export const FlowSection: React.FC = () => {
  const flowMoments = useMemo(
    () => [
      {
        id: "01",
        ambient: "Capture",
        title: "Captured in motion",
        description:
          "Cognia floats beside your cursor, quietly bookmarking the pages you touch—no pop-ups, no copy-paste drills, just an ambient save.",
        caption: "Feels like your browser remembers the good parts for you.",
        position: "top",
      },
      {
        id: "02",
        ambient: "Weave",
        title: "Context connects itself",
        description:
          "Moments that rhyme get threaded together: articles, chats, screenshots, and research trails fold into a single storyline.",
        caption: "The mesh glows brighter wherever curiosity overlaps.",
        position: "bottom",
      },
      {
        id: "03",
        ambient: "Recall",
        title: "Memories answer back",
        description:
          "Ask in plain language and the exact highlight lights up with source, timestamp, and the why behind it.",
        caption: "Replies arrive with receipts you’ve already seen.",
        position: "top",
      },
    ],
    []
  )

  return (
    <Section className="bg-transparent py-8 sm:py-12 md:py-16 lg:py-20 xl:py-24">
      <style>{`
        @keyframes flowLineMove {
          0% { background-position: 0 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <AnimatedStagger className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 md:mb-16"
          variants={fadeUpVariants}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3 sm:mb-4">
            Flow
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            Mesh
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-light font-editorial mb-3 sm:mb-4 px-2 sm:px-0">
            From browsing to memory
          </h2>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-gray-700 px-4 sm:px-2 md:px-0 leading-relaxed">
            A soft animation runs behind every tab: first capture, then weave,
            and finally a memory that answers you back.
          </p>
        </motion.div>

        <div className="relative mt-8 sm:mt-12 md:mt-16 overflow-hidden rounded-[32px]">
          <div
            className="hidden 2xl:block absolute top-1/2 left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-gray-400/60 to-transparent rounded-full opacity-70 z-0"
            style={{
              backgroundSize: "200% 100%",
              animation: "flowLineMove 8s linear infinite",
            }}
          />
          <div className="hidden 2xl:block absolute top-1/2 left-10 right-10 pointer-events-none z-0">
            <div className="relative h-0">
              <motion.div
                className="absolute -top-3 left-0 w-6 h-6 rounded-full bg-gradient-to-r from-gray-900 to-gray-600 shadow-lg shadow-gray-400/40"
                animate={{
                  x: [0, 880, 0],
                  scale: [1, 1.08, 1],
                }}
                transition={{
                  duration: 9,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          </div>

          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 z-10">
            {flowMoments.map((moment, index) => (
              <motion.div
                key={moment.id}
                className={`relative text-center lg:text-left pb-8 sm:pb-10 2xl:pb-0 z-10 ${
                  moment.position === "top"
                    ? "2xl:pb-16"
                    : "2xl:pt-16 2xl:mt-16"
                }`}
                variants={fadeUpVariants}
                transition={{ delay: index * 0.12 }}
              >
                <div
                  className={`hidden 2xl:block absolute left-1/2 -translate-x-1/2 w-px h-14 bg-gradient-to-b from-gray-300 via-gray-200 to-transparent z-0 ${
                    moment.position === "top" ? "bottom-0" : "top-0 rotate-180"
                  }`}
                />
                <div
                  className={`hidden 2xl:block absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gray-900 z-0 ${
                    moment.position === "top"
                      ? "bottom-0 translate-y-1/2"
                      : "top-0 -translate-y-1/2"
                  }`}
                />
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2 sm:mb-3">
                  <span className="font-mono text-[9px] sm:text-[10px] text-gray-600">
                    {moment.id}
                  </span>
                  {moment.ambient}
                </div>
                <h3 className="text-lg sm:text-xl lg:text-2xl font-light font-editorial text-black mb-2 sm:mb-3">
                  {moment.title}
                </h3>
                <p className="text-sm sm:text-base lg:text-lg text-gray-700 leading-relaxed mb-2 sm:mb-3 px-2 sm:px-0">
                  {moment.description}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 italic px-2 sm:px-0">
                  {moment.caption}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedStagger>
    </Section>
  )
}
