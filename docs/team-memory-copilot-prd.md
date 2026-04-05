# Team Memory Copilot PRD

## Summary

Cognia should evolve from a flat workspace into a team memory operating system. The first product slice introduces `Spaces`: durable containers for projects, clients, initiatives, and workstreams inside an organization. Spaces become the unit that future search, briefings, alerts, and permissions can attach to.

## Problem

Today an organization in Cognia has one shared pool of documents, search, integrations, and members. That works for basic collaboration, but it breaks down quickly for real teams:

- every project and client shares the same document surface
- there is no clean way to group context by initiative
- future features like scoped briefings, alerts, and workflows have nowhere to attach
- the product looks like storage plus search instead of a memory system for work

## Users

- founders and executives who need one place to track company context
- product, research, and strategy teams working across multiple initiatives
- agencies and consultancies managing multiple clients in one organization
- account and operations teams that need context grouped by customer or function

## Product Direction

Position Cognia as `Team Memory Copilot`: a system that captures team knowledge, organizes it by work context, and turns it into searchable, briefing-ready intelligence.

## Goals

- introduce a product layer above flat workspace storage
- let teams create clear work containers inside an org
- make spaces immediately useful with document routing
- keep the implementation additive so existing org flows keep working

## Non-Goals

- space-level permissions in this first slice
- scoped search or scoped briefings in this first slice
- deep workflow automation
- migration of all existing organization features to be space-aware

## MVP Slice

### Core objects

- `Organization`
  - existing top-level workspace
- `Space`
  - belongs to an organization
  - has name, slug, description, color, creator, timestamps
- `Document`
  - may optionally belong to a space

### User experience

- users can open a `Spaces` tab inside a workspace
- admins and editors can create and edit spaces
- admins can delete spaces
- document uploads can be optionally assigned to a space
- the document library can be filtered by space
- every new organization starts with a default `General` space

## Success Metrics

- percentage of organizations with at least one custom space
- percentage of uploaded documents assigned to a space
- repeat weekly use of the spaces tab
- increase in multi-document org usage after spaces launch

## API Requirements

- list spaces for an organization
- create a space
- update a space
- delete a space
- accept optional `spaceId` on document upload
- include document space metadata in document responses

## UI Requirements

- spaces tab in the organization workspace
- space cards with name, description, color, creator, and document count
- create/edit dialog for spaces
- upload selector for assigning new documents to a space
- document filter for viewing all docs or a single space

## Future Slices

- scope search and answer generation to a space
- generate space-level briefings and alerts
- attach integrations to one or more spaces
- add templates for spaces such as `Client`, `Product`, `Deal`, or `Executive`
- support pinned answers, goals, and activity per space

## Release Notes

This slice is the foundation, not the full product. It adds the durable organizational primitive needed to turn Cognia from a workspace with files into a memory system organized around real work.
