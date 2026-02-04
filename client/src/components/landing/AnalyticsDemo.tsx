import React, { useEffect, useRef, useState } from "react"

import { Section } from "./Section"

const stats = [
  { id: "memories", label: "Memories", value: 1247, suffix: "" },
  { id: "tokens", label: "Tokens Used", value: 842, suffix: "K" },
  { id: "searches", label: "Searches", value: 328, suffix: "" },
  { id: "days", label: "Days Active", value: 45, suffix: "" },
]

const activityData = [
  { day: "Mon", value: 12 },
  { day: "Tue", value: 28 },
  { day: "Wed", value: 19 },
  { day: "Thu", value: 35 },
  { day: "Fri", value: 22 },
  { day: "Sat", value: 8 },
  { day: "Sun", value: 5 },
]

const topicTags = [
  { label: "React", count: 89, color: "#3B82F6" },
  { label: "TypeScript", count: 67, color: "#3178C6" },
  { label: "Design", count: 54, color: "#EC4899" },
  { label: "APIs", count: 48, color: "#10B981" },
  { label: "Testing", count: 41, color: "#F59E0B" },
  { label: "DevOps", count: 36, color: "#8B5CF6" },
]

const patterns = [
  { label: "Peak hour", value: "2:00 PM" },
  { label: "Most active", value: "Tuesday" },
  { label: "Avg. session", value: "23 min" },
]

const sentiments = [
  { label: "Positive", value: 62, color: "#22C55E" },
  { label: "Neutral", value: 31, color: "#9CA3AF" },
  { label: "Negative", value: 7, color: "#EF4444" },
]

// Animated counter hook
const useAnimatedCounter = (
  target: number,
  duration: number = 1500,
  shouldAnimate: boolean = false
) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!shouldAnimate) return

    let startTime: number | null = null
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)

      // Easing function (ease-out-expo)
      const eased = 1 - Math.pow(2, -10 * progress)
      setCount(Math.floor(eased * target))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [target, duration, shouldAnimate])

  return count
}

const AnimatedStat: React.FC<{
  label: string
  value: number
  suffix: string
  isInView: boolean
  delay: number
}> = ({ label, value, suffix, isInView, delay }) => {
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const animatedValue = useAnimatedCounter(value, 1500, shouldAnimate)

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => setShouldAnimate(true), delay)
      return () => clearTimeout(timer)
    }
  }, [isInView, delay])

  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl lg:text-4xl font-light font-editorial text-gray-900">
        {animatedValue.toLocaleString()}
        {suffix}
      </div>
      <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mt-1">
        {label}
      </div>
    </div>
  )
}

export const AnalyticsDemo: React.FC = () => {
  const [isInView, setIsInView] = useState(false)
  const [showBars, setShowBars] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isInView) {
            setIsInView(true)
          }
        })
      },
      { threshold: 0.2 }
    )

    const currentContainer = containerRef.current
    if (currentContainer) {
      observer.observe(currentContainer)
    }

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer)
      }
    }
  }, [isInView])

  useEffect(() => {
    if (!isInView) return

    const timers: ReturnType<typeof setTimeout>[] = []

    timers.push(
      setTimeout(() => {
        setShowBars(true)
      }, 800)
    )

    timers.push(
      setTimeout(() => {
        setShowTags(true)
      }, 1200)
    )

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [isInView])

  const maxBarValue = Math.max(...activityData.map((d) => d.value))

  return (
    <Section className="bg-transparent py-12 sm:py-16 lg:py-20 xl:py-24">
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes barGrow {
          from { height: 0; }
          to { height: var(--bar-height); }
        }
        @keyframes tagPop {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        ref={containerRef}
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3 sm:mb-4">
            Analytics
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            Insights
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-light font-editorial mb-3 sm:mb-4 px-2 sm:px-0">
            Understand your patterns
          </h2>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-gray-700 px-4 sm:px-2 md:px-0 leading-relaxed">
            See how you capture and use knowledge. Discover your peak hours,
            favorite topics, and usage patterns over time.
          </p>
        </div>

        {/* Stats Row */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mb-8"
          style={{
            animation: isInView ? "slideInUp 0.6s ease-out 0.2s both" : "none",
          }}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.id}
              className="p-4 sm:p-6 rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <AnimatedStat
                label={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                isInView={isInView}
                delay={200 + index * 150}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Chart */}
          <div
            className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-6"
            style={{
              animation: isInView
                ? "fadeInScale 0.6s ease-out 0.4s both"
                : "none",
            }}
          >
            <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-4">
              Weekly Activity
            </p>
            <div className="flex items-end justify-between gap-2 h-32">
              {activityData.map((data, index) => {
                const heightPercent = (data.value / maxBarValue) * 100
                return (
                  <div
                    key={data.day}
                    className="flex-1 flex flex-col items-center gap-2"
                  >
                    <div className="w-full flex items-end justify-center h-24">
                      <div
                        className="w-full max-w-8 bg-gray-900 rounded-t transition-all duration-500"
                        style={
                          {
                            "--bar-height": `${heightPercent}%`,
                            height: showBars ? `${heightPercent}%` : "0%",
                            transitionDelay: `${index * 100}ms`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                    <span className="text-xs text-gray-500">{data.day}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Patterns Panel */}
          <div
            className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-6"
            style={{
              animation: isInView
                ? "fadeInScale 0.6s ease-out 0.5s both"
                : "none",
            }}
          >
            <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-4">
              Patterns
            </p>
            <div className="space-y-4">
              {patterns.map((pattern) => (
                <div
                  key={pattern.label}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-gray-600">{pattern.label}</span>
                  <span className="text-sm font-mono text-gray-900">
                    {pattern.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Sentiment Distribution */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                Content Sentiment
              </p>
              <div className="flex h-2 rounded-full overflow-hidden">
                {sentiments.map((sentiment) => (
                  <div
                    key={sentiment.label}
                    className="transition-all duration-500"
                    style={{
                      width: `${sentiment.value}%`,
                      backgroundColor: sentiment.color,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2">
                {sentiments.map((sentiment) => (
                  <div
                    key={sentiment.label}
                    className="flex items-center gap-1"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: sentiment.color }}
                    />
                    <span className="text-xs text-gray-500">
                      {sentiment.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Topic Tags Cloud */}
        <div
          className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-6"
          style={{
            animation: isInView
              ? "fadeInScale 0.6s ease-out 0.6s both"
              : "none",
          }}
        >
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-4">
            Top Topics
          </p>
          <div className="flex flex-wrap gap-2">
            {topicTags.map((tag, index) => (
              <div
                key={tag.label}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 transition-all duration-300 hover:border-gray-300"
                style={{
                  opacity: showTags ? 1 : 0,
                  transform: showTags ? "scale(1)" : "scale(0.8)",
                  transitionDelay: `${index * 80}ms`,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm text-gray-700">{tag.label}</span>
                <span className="text-xs font-mono text-gray-500">
                  {tag.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}
