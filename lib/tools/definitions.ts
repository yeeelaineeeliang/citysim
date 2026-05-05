import type Groq from 'groq-sdk'

export const TOOL_DEFINITIONS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_crime',
      description:
        'Get crime statistics for a Chicago neighborhood in a specific month. Use for any question about safety, crime incidents, how dangerous or safe a neighborhood feels at night.',
      parameters: {
        type: 'object',
        properties: {
          neighborhood: { type: 'string', description: 'Chicago community area name, e.g. "Hyde Park"' },
          month: { type: 'number', description: 'Month number 1–12' },
          year: { type: 'number', description: 'Year (defaults to 2024)' },
        },
        required: ['neighborhood', 'month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_transit',
      description:
        'Get CTA transit data for a Chicago neighborhood in a specific month. Use for questions about commute, buses, trains, L stops, CTA ridership, crowding, or getting around the city.',
      parameters: {
        type: 'object',
        properties: {
          neighborhood: { type: 'string', description: 'Chicago community area name' },
          month: { type: 'number', description: 'Month number 1–12' },
        },
        required: ['neighborhood', 'month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_311',
      description:
        'Get 311 service request data for a neighborhood — city responsiveness to potholes, broken streetlights, graffiti, tree debris, etc. Use for questions about city services, neighborhood maintenance, or how quickly the city responds to issues.',
      parameters: {
        type: 'object',
        properties: {
          neighborhood: { type: 'string', description: 'Chicago community area name' },
          month: { type: 'number', description: 'Month number 1–12' },
        },
        required: ['neighborhood', 'month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_housing',
      description:
        'Get affordable housing unit counts and average rent estimate for a neighborhood. Use for questions about cost of living, affordability, rent, or housing options.',
      parameters: {
        type: 'object',
        properties: {
          neighborhood: { type: 'string', description: 'Chicago community area name' },
        },
        required: ['neighborhood'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_entertainment',
      description:
        'Get restaurants, bars, parks, and lifestyle amenities for a neighborhood. Use for questions about dining, nightlife, green space, things to do on weekends, or local character.',
      parameters: {
        type: 'object',
        properties: {
          neighborhood: { type: 'string', description: 'Chicago community area name' },
          month: { type: 'number', description: 'Optional month 1–12 for seasonal context (e.g. farmers markets)' },
        },
        required: ['neighborhood'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_neighborhood_profile',
      description:
        'Get general profile and character description of a Chicago neighborhood. Use as a baseline for broad questions about a neighborhood, or when no more specific tool applies.',
      parameters: {
        type: 'object',
        properties: {
          neighborhood: { type: 'string', description: 'Chicago community area name' },
        },
        required: ['neighborhood'],
      },
    },
  },
]
