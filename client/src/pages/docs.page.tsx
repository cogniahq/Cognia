import React, { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Header } from "@/components/landing/Header"

const TableOfContents: React.FC<{ onSectionClick: (id: string) => void }> = ({
  onSectionClick,
}) => {
  const sections = [
    { id: "what-is", title: "What is Cognia?" },
    { id: "quick-start", title: "Quick Start" },
    { id: "features", title: "Key Features" },
    { id: "how-to-use", title: "How to Use" },
    { id: "browser-extension", title: "Browser Extension" },
    { id: "web-client", title: "Web Client" },
    { id: "search", title: "Search & AI Answers" },
    { id: "memory-mesh", title: "Memory Mesh" },
    { id: "backend-architecture", title: "Backend Architecture" },
    { id: "api-reference", title: "API Reference" },
    { id: "troubleshooting", title: "Troubleshooting" },
    { id: "faq", title: "FAQ" },
  ]

  return (
    <div className="sticky top-20 bg-card border border-border p-4 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-lg">
      <h3 className="text-sm font-mono uppercase tracking-wide text-foreground mb-4">
        Table of Contents
      </h3>
      <nav className="space-y-1">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className="block w-full text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2 py-1 transition-colors rounded"
          >
            {section.title}
          </button>
        ))}
      </nav>
    </div>
  )
}

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code }) => {
  return (
    <div className="bg-muted text-foreground p-4 rounded border border-border overflow-x-auto">
      <code className="font-mono text-sm">{code}</code>
    </div>
  )
}

const InfoBox: React.FC<{
  type: "info" | "warning" | "tip"
  children: React.ReactNode
}> = ({ type, children }) => {
  const styles = {
    info: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    warning:
      "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    tip: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
  }

  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    tip: "💡",
  }

  return (
    <div className={`border p-4 rounded ${styles[type]}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none mt-0.5">{icons[type]}</span>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

export const Docs = () => {
  const navigate = useNavigate()
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const faqs = [
    {
      question: "Does the extension slow down my browser?",
      answer:
        "No. The extension is designed to be lightweight and only captures content when you switch tabs or load new pages. It doesn't monitor your activity in real-time.",
    },

    {
      question: "Can I delete memories?",
      answer: "Yes. You can delete memories from the database at any time.",
    },
    {
      question: "What AI models do you use?",
      answer:
        "We use Google Gemini for embeddings and summarization by default. The system includes fallback mechanisms and supports local AI processing for complete privacy.",
    },
    {
      question: "How does the ChatGPT integration work?",
      answer:
        "The browser extension automatically detects when you're typing in ChatGPT, searches your memories for relevant context, and injects memory summaries into your prompts with a 1.5-second delay.",
    },
    {
      question: "What is the Memory Mesh?",
      answer:
        "The Memory Mesh is a 3D knowledge graph that shows connections between your memories. It uses vector embeddings to find semantic relationships and helps you discover unexpected learning patterns.",
    },
    {
      question: "How does hybrid search work?",
      answer:
        "Hybrid search combines keyword matching (40% weight) with semantic search using vector embeddings (60% weight) to provide comprehensive results with relevance scoring.",
    },
  ]

  return (
    <div className="min-h-screen bg-background pt-24">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold font-editorial mb-8 text-foreground">Documentation</h1>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <TableOfContents onSectionClick={scrollToSection} />
          </aside>

          <main className="lg:col-span-3 space-y-12">
            <section id="what-is">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-border pb-2 text-foreground">
                What is Cognia?
              </h2>
              <div className="prose prose-neutral dark:prose-invert max-w-none space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  Cognia is like having a super-powered memory for everything
                  you read online. It remembers what you've seen, helps you find
                  it later, and even connects the dots between related things
                  you've learned.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Here's what makes it special:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>
                    <strong>It remembers automatically</strong> - Just browse
                    the web like normal, and Cognia saves what you're reading
                  </li>
                  <li>
                    <strong>It understands what you read</strong> - Uses AI to
                    create quick summaries so you can find things fast
                  </li>
                  <li>
                    <strong>It finds connections</strong> - Shows you how
                    different things you've read relate to each other
                  </li>
                  <li>
                    <strong>It searches like you think</strong> - Ask questions
                    naturally, and it finds what you're looking for even if you
                    don't remember the exact words
                  </li>
                  <li>
                    <strong>It works with ChatGPT</strong> - Automatically
                    brings your memories into your ChatGPT conversations when
                    they're relevant
                  </li>
                </ul>
              </div>
            </section>

            <section id="quick-start">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-border pb-2 text-foreground">
                Quick Start
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2 text-foreground">
                    1. Get Started
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    First, you'll need a user ID. Don't worry - this happens
                    automatically when you install the extension. It's just a
                    way to keep all your memories connected to you.
                  </p>
                  <InfoBox type="tip">
                    Your user ID is created automatically when you first install
                    the extension. You don't need to do anything special!
                  </InfoBox>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2 text-foreground">
                    2. Install the Extension
                  </h3>
                  <p className="text-muted-foreground mb-3">
                    Install our browser extension for Chrome or Brave. This lets
                    Cognia automatically save what you're reading. If you
                    prefer, you can also add things manually through the
                    website.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2 text-foreground">
                    3. Just Browse
                  </h3>
                  <p className="text-muted-foreground">
                    That's it! Just use the internet like you normally do. If
                    you have the extension installed, Cognia will save pages
                    automatically. Otherwise, you can add things manually
                    whenever you want.
                  </p>
                </div>
              </div>
            </section>

            <section id="features">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-border pb-2 text-foreground">
                Key Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border p-4 rounded">
                  <h3 className="font-medium mb-2 text-foreground">Smart Memory Storage</h3>
                  <p className="text-sm text-muted-foreground">
                    Everything you save is stored in a way that makes it easy to
                    find later, even if you don't remember the exact words
                    you're looking for.
                  </p>
                </div>
                <div className="bg-card border border-border p-4 rounded">
                  <h3 className="font-medium mb-2 text-foreground">Natural Search</h3>
                  <p className="text-sm text-muted-foreground">
                    Search works like your brain does - it finds things by
                    meaning, not just matching words. Ask questions the way
                    you'd ask a friend.
                  </p>
                </div>
                <div className="bg-card border border-border p-4 rounded">
                  <h3 className="font-medium mb-2 text-foreground">Connected Memories</h3>
                  <p className="text-sm text-muted-foreground">
                    Cognia automatically finds relationships between different
                    things you've read, showing you how your knowledge connects.
                  </p>
                </div>

                <div className="bg-card border border-border p-4 rounded">
                  <h3 className="font-medium mb-2 text-foreground">ChatGPT Helper</h3>
                  <p className="text-sm text-muted-foreground">
                    When you're chatting with ChatGPT, Cognia automatically
                    brings in relevant things you've read to make your
                    conversations better.
                  </p>
                </div>
              </div>
            </section>

            <section id="how-to-use">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-gray-200 pb-2">
                How to Use
              </h2>
              <p className="text-gray-700 mb-4">
                You can use Cognia in two ways: let the browser extension
                automatically save things as you browse, or manually add things
                through the website whenever you want.
              </p>
            </section>

            <section id="browser-extension">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-gray-200 pb-2">
                Browser Extension
              </h2>
              <div className="space-y-4">
                <p className="text-gray-700">
                  The browser extension works quietly in the background, saving
                  what you read and helping out when you're using ChatGPT. It's
                  like having a helpful assistant that remembers everything for
                  you.
                </p>

                <h3 className="text-lg font-medium">Getting Started</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>
                    Install the extension from the Chrome Web Store (or build it
                    yourself if you're feeling adventurous)
                  </li>
                  <li>
                    Make sure your Cognia server is running (if you're running
                    it yourself, it should be at http://localhost:3000)
                  </li>
                  <li>
                    That's it! Just start browsing and using ChatGPT - Cognia
                    will handle the rest automatically.
                  </li>
                </ol>

                <h3 className="text-lg font-medium mt-6">How It Works</h3>
                <p className="text-gray-700">
                  The extension saves pages automatically when you:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li>Open a new tab or visit a new page</li>
                  <li>
                    Spend some time reading something (it knows when you're
                    actually reading)
                  </li>
                  <li>Navigate to different websites</li>
                </ul>

                <h3 className="text-lg font-medium mt-6">
                  ChatGPT Integration
                </h3>
                <p className="text-gray-700">
                  When you're chatting with ChatGPT, Cognia:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li>Knows when you're typing in ChatGPT</li>
                  <li>
                    Looks through your saved memories to find relevant stuff
                  </li>
                  <li>Quietly adds helpful context to your messages</li>
                  <li>Shows you a little icon so you know it's working</li>
                </ul>

                <InfoBox type="warning">
                  Cognia is privacy-friendly - it works well with privacy
                  extensions like uBlock Origin and won't try to save pages on
                  your local computer.
                </InfoBox>
              </div>
            </section>

            <section id="web-client">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-gray-200 pb-2">
                Web Client
              </h2>
              <div className="space-y-4">
                <p className="text-gray-700">
                  The website is where you can see everything you've saved, add
                  new things manually, search through your memories, and manage
                  your account. It's your command center for everything Cognia
                  knows.
                </p>

                <h3 className="text-lg font-medium">Main Pages</h3>
                <div className="space-y-3">
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Landing</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Welcome page with product overview and features.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Memories</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      See everything you've saved, filter and search through it,
                      and explore a cool 3D visualization showing how your
                      memories connect to each other.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Analytics</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Get insights into what you've been reading - see stats,
                      topics you're interested in, and what's being processed.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Profile</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Manage your account settings and see your profile
                      information.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Documentation</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Complete documentation and API reference.
                    </p>
                  </div>
                </div>

                <h3 className="text-lg font-medium mt-6">Features</h3>
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Search</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Search naturally - ask questions the way you'd ask a
                      friend. Get AI-generated answers with sources, and see how
                      relevant each result is. Press Cmd/Ctrl+K for quick search
                      or use it right in the Memories page.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Command Menu</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Press Cmd/Ctrl+K to quickly jump anywhere or do common
                      tasks. It's like having a super-fast navigation system.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Dark Mode</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Switch between light and dark themes, or let it match your
                      system preferences. Your eyes will thank you.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">
                      Privacy & Audit Logs
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      See a log of what's happening with your account - useful
                      for keeping track of your data (available through the
                      API).
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Email Drafting</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Need help writing an email? Cognia can draft replies based
                      on your saved memories (available through the API).
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section id="search">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-gray-200 pb-2">
                Search & AI Answers
              </h2>
              <div className="space-y-4">
                <p className="text-gray-700">
                  Cognia's search is smart - it understands what you mean, not
                  just the words you type. Ask questions naturally, like "what
                  did I read about React hooks?" and it'll find the right stuff.
                  You can search by pressing Cmd/Ctrl+K or right in the Memories
                  page.
                </p>

                <h3 className="text-lg font-medium">How Search Works</h3>
                <p className="text-gray-700 mb-4">
                  When you search, Cognia does a few smart things behind the
                  scenes:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>
                    It figures out what kind of question you're asking - are you
                    looking for something specific, or browsing broadly?
                  </li>
                  <li>
                    It understands the meaning of your question, not just the
                    words
                  </li>
                  <li>
                    It searches through your memories by meaning (like how your
                    brain connects ideas)
                  </li>
                  <li>
                    It also searches by matching words in titles and content
                  </li>
                  <li>
                    It combines both approaches to give you the best results
                  </li>
                  <li>It filters out stuff that's not really relevant</li>
                  <li>
                    It uses AI to write you a helpful answer based on what it
                    found, with links back to the original sources
                  </li>
                  <li>
                    It remembers recent searches so they're faster next time
                  </li>
                </ol>

                <h3 className="text-lg font-medium mt-6">
                  How It Finds Things
                </h3>
                <div className="space-y-2">
                  <div className="bg-blue-50 border border-blue-200 p-3">
                    <h4 className="font-medium text-sm text-blue-900">
                      Word Matching
                    </h4>
                    <p className="text-xs text-blue-800 mt-1">
                      Finds things that contain the words you're looking for,
                      checking both titles and content. You can filter by topic,
                      category, or date.
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 p-3">
                    <h4 className="font-medium text-sm text-purple-900">
                      Meaning Matching
                    </h4>
                    <p className="text-xs text-purple-800 mt-1">
                      Understands what you mean even if you use different words.
                      Like if you search for "React hooks" it'll find things
                      about "useState" and "useEffect" too, because they're
                      related.
                    </p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 p-3">
                    <h4 className="font-medium text-sm text-indigo-900">
                      The Best of Both
                    </h4>
                    <p className="text-xs text-indigo-800 mt-1">
                      Cognia uses both methods together - word matching and
                      meaning matching - then combines the results to give you
                      the most relevant stuff first.
                    </p>
                  </div>
                </div>

                <h3 className="text-lg font-medium mt-6">Example Queries</h3>
                <div className="space-y-2">
                  <CodeBlock
                    code={`"React hooks best practices"\n"semantic search"\n"what did I learn about GraphQL?"`}
                  />
                </div>

                <InfoBox type="tip">
                  Just ask naturally! Type questions the way you'd ask a friend.
                  "What did I read about React?" works better than just "React".
                  Be specific and descriptive for the best results.
                </InfoBox>

                <h3 className="text-lg font-medium mt-6">AI Answer Format</h3>
                <div className="bg-white border border-gray-200 p-4"></div>
              </div>
            </section>

            <section id="memory-mesh">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-gray-200 pb-2">
                Memory Mesh
              </h2>
              <div className="space-y-4">
                <p className="text-gray-700">
                  The Memory Mesh is like a map of your knowledge - it
                  automatically finds connections between different things
                  you've read. Think of it like how your brain connects related
                  ideas, but visualized in a cool 3D graph.
                </p>

                <h3 className="text-lg font-medium">How Memories Connect</h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 p-3">
                    <h4 className="font-medium text-sm text-blue-900">
                      Similar Content
                    </h4>
                    <p className="text-xs text-blue-800 mt-1">
                      Finds memories that talk about similar things, even if
                      they use different words. Like connecting an article about
                      "React hooks" with one about "useState and useEffect"
                      because they're really about the same topic.
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 p-3">
                    <h4 className="font-medium text-sm text-green-900">
                      Same Topics
                    </h4>
                    <p className="text-xs text-green-800 mt-1">
                      Links things that share topics, categories, or key ideas.
                      If you read multiple things about the same subject,
                      they'll be connected. Things from the same website also
                      get a little boost.
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 p-3">
                    <h4 className="font-medium text-sm text-purple-900">
                      Time-Based
                    </h4>
                    <p className="text-xs text-purple-800 mt-1">
                      Connects things you read around the same time. Memories
                      from the same hour are strongly linked, same day gets a
                      good connection, and so on. It's like remembering what you
                      were reading together.
                    </p>
                  </div>
                </div>

                <h3 className="text-lg font-medium mt-6">The 3D View</h3>
                <p className="text-gray-700">
                  On the Memories page, you'll see a cool 3D visualization of
                  all your memories. Each dot is something you've saved, and the
                  lines between them show how they're connected. You can:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>Drag around to explore the 3D space</li>
                  <li>Click on any dot to see what that memory is about</li>
                  <li>
                    Filter to see only strong connections or specific types
                  </li>
                  <li>Zoom in to see clusters of related memories</li>
                </ul>

                <h3 className="text-lg font-medium mt-6">
                  How It Builds Connections
                </h3>
                <p className="text-gray-700 mb-4">
                  When you save something new, Cognia automatically:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>
                    <strong>Understands it:</strong> Analyzes what you saved to
                    understand what it's about
                  </li>
                  <li>
                    <strong>Finds related stuff:</strong> Looks through your
                    other memories to find things that are similar, on the same
                    topic, or from around the same time
                  </li>
                  <li>
                    <strong>Checks if they're really related:</strong> For
                    connections that might be a stretch, it uses AI to
                    double-check if they're actually related
                  </li>
                  <li>
                    <strong>Saves the connections:</strong> Stores how
                    everything links together
                  </li>
                  <li>
                    <strong>Keeps it clean:</strong> Removes weak connections
                    and keeps only the meaningful ones
                  </li>
                  <li>
                    <strong>Makes it visual:</strong> Arranges everything in 3D
                    space so related things are close together
                  </li>
                </ol>

                <InfoBox type="info">
                  The mesh helps you discover connections you might not have
                  noticed. You'll need at least 5-10 memories saved before you
                  start seeing meaningful connections. This all happens in the
                  background after you save something, so you don't have to wait
                  around.
                </InfoBox>
              </div>
            </section>

            <section id="backend-architecture">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-gray-200 pb-2">
                How It Works Behind the Scenes
              </h2>
              <div className="space-y-4">
                <p className="text-gray-700">
                  Cognia uses modern web technologies to make everything fast
                  and reliable. Here's the simple version of what happens:
                </p>

                <h3 className="text-lg font-medium">When You Save Something</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>
                    <strong>You send it:</strong> The extension or website sends
                    what you want to save
                  </li>
                  <li>
                    <strong>We check for duplicates:</strong> Makes sure we're
                    not saving the same thing twice
                  </li>
                  <li>
                    <strong>We save it:</strong> Stores it in the database
                  </li>
                  <li>
                    <strong>We understand it:</strong> Uses AI to understand
                    what it's about so it can be found later
                  </li>
                  <li>
                    <strong>We connect it:</strong> Finds other things you've
                    saved that are related and links them together
                  </li>
                </ol>

                <h3 className="text-lg font-medium mt-6">
                  Background Processing
                </h3>
                <p className="text-gray-700">
                  A lot of the heavy lifting happens in the background so you
                  don't have to wait:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>
                    <strong>Content processing:</strong> If something needs more
                    work, it gets queued up and processed when ready (with
                    automatic retries if something goes wrong)
                  </li>
                  <li>
                    <strong>Profile updates:</strong> Your profile gets updated
                    based on what you're reading and learning
                  </li>
                </ul>

                <h3 className="text-lg font-medium mt-6">How Search Works</h3>
                <p className="text-gray-700">When you search, Cognia:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>
                    <strong>Understands your question:</strong> Figures out what
                    you're really looking for
                  </li>
                  <li>
                    <strong>Searches two ways:</strong> By meaning and by
                    matching words, then combines the results
                  </li>
                  <li>
                    <strong>Gets smarter:</strong> Adjusts how it searches based
                    on whether you're looking for something specific or browsing
                    broadly
                  </li>
                  <li>
                    <strong>Remembers recent searches:</strong> Caches results
                    so common searches are super fast
                  </li>
                </ul>

                <h3 className="text-lg font-medium mt-6">AI Options</h3>
                <p className="text-gray-700">
                  Cognia can work with different AI services:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  <li>
                    <strong>Google Gemini:</strong> The default option, great
                    quality and fast
                  </li>
                  <li>
                    <strong>Ollama:</strong> Run AI locally on your computer for
                    complete privacy
                  </li>
                  <li>
                    <strong>Automatic fallback:</strong> If one option isn't
                    available, it automatically tries another
                  </li>
                </ul>

                <h3 className="text-lg font-medium mt-6">
                  Where Your Data Lives
                </h3>
                <div className="space-y-2">
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">PostgreSQL Database</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Stores all your memories, connections between them, and
                      account information. This is the main database.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Qdrant</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Special database for understanding the meaning of your
                      memories. This is what makes the smart search work.
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Redis</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Handles background jobs and makes searches faster by
                      remembering recent results.
                    </p>
                  </div>
                </div>

                <InfoBox type="tip">
                  Everything is designed to be fast and reliable. Processing
                  happens in the background so you don't have to wait, and there
                  are backup plans if something goes wrong.
                </InfoBox>
              </div>
            </section>

            <section id="api-reference">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-gray-200 pb-2">
                API Reference
              </h2>
              <div className="space-y-4">
                <p className="text-gray-700">
                  If you want to build something cool with Cognia, we have an
                  API that lets you access all your memories and use Cognia's
                  features programmatically.
                </p>

                <h3 className="text-lg font-medium">Core Endpoints</h3>
                <div className="space-y-3">
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Memory Management</h4>
                    <div className="text-xs text-gray-600 mt-1 space-y-1">
                      <p>
                        <code>POST /api/memory/process</code> - Process new
                        content (requires auth token)
                      </p>
                      <p>
                        <code>GET /api/memory/user/recent</code> - Get recent
                        memories (query: count)
                      </p>
                      <p>
                        <code>GET /api/memory/user/count</code> - Get memory
                        count
                      </p>
                      <p>
                        <code>DELETE /api/memory/:memoryId</code> - Delete a
                        memory
                      </p>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Search & AI</h4>
                    <div className="text-xs text-gray-600 mt-1 space-y-1">
                      <p>
                        <code>GET /api/memory/search</code> - Semantic search
                        with AI answers (query: query, limit)
                      </p>
                      <p>
                        <code>GET /api/memory/search-embeddings</code> -
                        Semantic-only search (query: query, limit, category,
                        topic, sentiment, source, dateRange, page)
                      </p>
                      <p>
                        <code>GET /api/memory/search-hybrid</code> - Hybrid
                        search combining keyword and semantic (query: query,
                        limit, filters, page)
                      </p>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Memory Mesh</h4>
                    <div className="text-xs text-gray-600 mt-1 space-y-1">
                      <p>
                        <code>GET /api/memory/mesh</code> - Get memory mesh
                        graph (query: limit, threshold)
                      </p>
                      <p>
                        <code>GET /api/memory/relations/:memoryId</code> - Get
                        memory with relations
                      </p>
                      <p>
                        <code>GET /api/memory/cluster/:memoryId</code> - Get
                        memory cluster (query: depth)
                      </p>
                      <p>
                        <code>POST /api/memory/process-mesh/:memoryId</code> -
                        Process memory for mesh
                      </p>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Analytics</h4>
                    <div className="text-xs text-gray-600 mt-1 space-y-1">
                      <p>
                        <code>GET /api/analytics</code> - Get analytics data
                        (memory stats, topics, categories)
                      </p>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Profile</h4>
                    <div className="text-xs text-gray-600 mt-1 space-y-1">
                      <p>
                        <code>GET /api/profile</code> - Get user profile
                      </p>
                      <p>
                        <code>POST /api/profile/refresh</code> - Refresh user
                        profile
                      </p>
                      <p>
                        <code>GET /api/profile/context</code> - Get profile
                        context for AI operations
                      </p>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Privacy</h4>
                    <div className="text-xs text-gray-600 mt-1 space-y-1">
                      <p>
                        <code>GET /api/privacy/audit-logs</code> - Get audit
                        logs (query: eventType, eventCategory, domain, limit,
                        offset, startDate, endDate)
                      </p>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 p-3">
                    <h4 className="font-medium text-sm">Email Drafting</h4>
                    <div className="text-xs text-gray-600 mt-1 space-y-1">
                      <p>
                        <code>POST /api/content/email/draft</code> - Generate
                        AI-powered email reply (body: thread, context)
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-medium mt-6">Authentication</h3>
                <p className="text-gray-700">
                  The API uses JWT tokens. Include Authorization header:
                </p>
                <CodeBlock
                  code={`Authorization: Bearer <your-jwt-token>

Request body example:
{
  "content": "Your content here",
  "url": "https://example.com",
  "title": "Page Title",
  "metadata": {
    "source": "extension"
  }
}`}
                />

                <h3 className="text-lg font-medium mt-6">Response Format</h3>
                <p className="text-gray-700">
                  All API responses follow a consistent format:
                </p>
                <CodeBlock
                  code={`{
  "success": true,
  "data": {
    "memoryId": "uuid",
    "userId": "user-id"
  },
  "message": "Memory processed successfully"
}

Error response:
{
  "success": false,
  "error": "Error message"
}`}
                />

                <InfoBox type="info">
                  The API supports both synchronous and asynchronous operations.
                  Long-running tasks like AI processing may return job IDs for
                  status checking. All endpoints require authentication except
                  /health.
                </InfoBox>
              </div>
            </section>

            <section id="troubleshooting">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-gray-200 pb-2">
                Troubleshooting
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">
                    Extension not capturing pages
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    <li>Check extension is enabled in Chrome</li>
                    <li>
                      Verify API endpoint is correct in extension settings
                    </li>

                    <li>Check browser console for errors (F12)</li>
                    <li>Content must be &gt; 50 characters</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">
                    Search returns no results
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    <li>
                      Verify you have memories stored (check Memories page)
                    </li>

                    <li>
                      Wait for embeddings to be generated (5-30 seconds after
                      capture)
                    </li>
                    <li>Try a different search query or more general terms</li>
                  </ul>
                </div>
              </div>
            </section>

            <section id="faq">
              <h2 className="text-2xl font-light font-editorial mb-4 border-b border-gray-200 pb-2">
                Frequently Asked Questions
              </h2>
              <div className="space-y-2">
                {faqs.map((faq, index) => (
                  <div key={index} className="border border-gray-200 bg-white">
                    <button
                      onClick={() =>
                        setExpandedFaq(expandedFaq === index ? null : index)
                      }
                      className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium text-sm">
                        {faq.question}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {expandedFaq === index ? "−" : "+"}
                      </span>
                    </button>
                    {expandedFaq === index && (
                      <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-border pt-8 mt-12">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2 text-foreground">Need More Help?</h3>
                <p className="text-muted-foreground mb-4">
                  Check out our GitHub repository or join our community
                </p>
                <div className="flex items-center justify-center gap-4">
                  <a
                    href="https://github.com/cogniahq/Cognia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity rounded"
                  >
                    GitHub
                  </a>
                  <button
                    onClick={() => navigate("/")}
                    className="px-4 py-2 border border-border text-foreground text-sm hover:bg-accent hover:text-accent-foreground transition-colors rounded"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div >
  )
}
