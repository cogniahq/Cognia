import { memo, useEffect, useState } from "react"
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  Key,
  RefreshCw,
  Search,
  User,
} from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

const CommandMenuComponent = () => {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const enableInternalRoutes =
    import.meta.env.VITE_ENABLE_INTERNAL_ROUTES !== "false"

  const handleSelect = (callback: () => void) => {
    callback()
    setOpen(false)
  }

  useEffect(() => {
    if (!enableInternalRoutes) {
      return
    }
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      if (e.key === "Escape" && open) {
        e.preventDefault()
        setOpen(false)
        return
      }

      if (e.key === "/" && !isInput && !modKey) {
        e.preventDefault()
        const searchInput = document.querySelector(
          'input[type="search"], input[placeholder*="search" i], input[placeholder*="Search"]'
        ) as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        } else {
          setOpen(true)
        }
        return
      }

      if (isInput && !(e.key === "j" && modKey) && !(e.key === "k" && modKey)) {
        return
      }

      if (e.key === "j" && modKey) {
        e.preventDefault()
        setOpen((open) => !open)
        return
      }

      if (e.key === "k" && modKey) {
        e.preventDefault()
        setOpen((open) => !open)
        return
      }

      if (!modKey) return

      switch (e.key.toLowerCase()) {
        case "p":
          e.preventDefault()
          navigate("/profile")
          break
        case "m":
          e.preventDefault()
          navigate("/memories")
          break
        case "a":
          e.preventDefault()
          navigate("/analytics")
          break
        case "d":
          e.preventDefault()
          navigate("/docs")
          break
        case "h":
          e.preventDefault()
          navigate("/")
          break
        case "r":
          e.preventDefault()
          if (location.pathname === "/profile") {
            const buttons = Array.from(document.querySelectorAll("button"))
            const refreshButton = buttons.find(
              (btn) =>
                btn.textContent?.trim() === "Refresh" ||
                btn.textContent?.trim() === "Refreshing..."
            ) as HTMLButtonElement
            if (refreshButton && !refreshButton.disabled) {
              refreshButton.click()
            }
          } else {
            window.location.reload()
          }
          break
        case "[":
          e.preventDefault()
          if (window.history.length > 1) {
            navigate(-1)
          }
          break
      }

      if (e.key === "ArrowLeft" && modKey) {
        e.preventDefault()
        if (window.history.length > 1) {
          navigate(-1)
        }
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [navigate, location.pathname, open, enableInternalRoutes])

  if (!enableInternalRoutes) {
    return null
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => handleSelect(() => navigate("/"))}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Home</span>
              <CommandShortcut>⌘H</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/memories"))}
            >
              <Brain className="mr-2 h-4 w-4" />
              <span>Memories</span>
              <CommandShortcut>⌘M</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/analytics"))}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>Analytics</span>
              <CommandShortcut>⌘A</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect(() => navigate("/docs"))}>
              <BookOpen className="mr-2 h-4 w-4" />
              <span>Documentation</span>
              <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect(() => navigate("/api-keys"))}>
              <Key className="mr-2 h-4 w-4" />
              <span>API Keys</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                handleSelect(() => {
                  if (window.history.length > 1) {
                    navigate(-1)
                  }
                })
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Go Back</span>
              <CommandShortcut>⌘[</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                handleSelect(() => {
                  const searchInput = document.querySelector(
                    'input[type="search"], input[placeholder*="search" i], input[placeholder*="Search"]'
                  ) as HTMLInputElement
                  if (searchInput) {
                    searchInput.focus()
                    searchInput.select()
                  }
                })
              }}
            >
              <Search className="mr-2 h-4 w-4" />
              <span>Focus Search</span>
              <CommandShortcut>/</CommandShortcut>
            </CommandItem>
            {location.pathname === "/profile" && (
              <CommandItem
                onSelect={() => {
                  handleSelect(() => {
                    const buttons = Array.from(
                      document.querySelectorAll("button")
                    )
                    const refreshButton = buttons.find(
                      (btn) =>
                        btn.textContent?.trim() === "Refresh" ||
                        btn.textContent?.trim() === "Refreshing..."
                    ) as HTMLButtonElement
                    if (refreshButton && !refreshButton.disabled) {
                      refreshButton.click()
                    }
                  })
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                <span>Refresh Profile</span>
                <CommandShortcut>⌘R</CommandShortcut>
              </CommandItem>
            )}
            {location.pathname !== "/profile" && (
              <CommandItem
                onSelect={() => {
                  handleSelect(() => {
                    window.location.reload()
                  })
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                <span>Refresh Page</span>
                <CommandShortcut>⌘R</CommandShortcut>
              </CommandItem>
            )}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem
              onSelect={() => handleSelect(() => navigate("/profile"))}
            >
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

const CommandMenu = memo(CommandMenuComponent)
CommandMenu.displayName = "CommandMenu"
export { CommandMenu }
