import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { requireAuthToken } from "@/utils/auth"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"

import { ApiKeyManager } from "@/components/api-keys/ApiKeyManager"
import {
  fadeUpVariants,
  staggerContainerVariants,
} from "@/components/shared/site-motion-variants"

export function ApiKeys() {
  const navigate = useNavigate()
  const { isLoading: authLoading } = useAuth()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    try {
      requireAuthToken()
      setIsAuthenticated(true)
    } catch {
      navigate("/login")
    }
  }, [navigate])

  if (!isAuthenticated || authLoading) return null

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <motion.div
        className="space-y-8"
        initial="initial"
        animate="animate"
        variants={staggerContainerVariants}
      >
        <motion.div variants={fadeUpVariants}>
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3">
            Settings
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            Developer
          </div>
          <h1 className="text-2xl sm:text-3xl font-light font-editorial text-black">
            API keys
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Workspace-scoped credentials for the public Cognia API.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUpVariants}
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6"
        >
          <ApiKeyManager />
        </motion.div>
      </motion.div>
    </div>
  )
}

export default ApiKeys
