import { config } from 'dotenv'
config({ path: '.env.local' })
import { runChat } from '../lib/chat'
import type { ChatRequest } from '../lib/tools/types'

const req: ChatRequest = {
  message: 'What is crime like in Hyde Park in October?',
  neighborhood: 'Hyde Park',
  month: 10,
  year: 2024,
  profile: {
    budgetRange: '$1,000–$1,500',
    workplace: 'UChicago — 5600 S University Ave',
    commutePref: 'transit',
    priorities: { safety: 0.4, transit: 0.3, affordability: 0.2, cityServices: 0.05, entertainment: 0.05 },
    lifestyle: ['community safety', 'parks & outdoor space', 'short commute'],
    notes: 'Near the Red Line, prefer quiet evenings',
  },
}

async function main() {
  console.log('─'.repeat(60))
  console.log('Question:', req.message)
  console.log('─'.repeat(60))

  const result = await runChat(req)

  console.log('\nTools used:', result.toolsUsed.join(', '))
  console.log('\nResponse:\n')
  console.log(result.response)
  console.log('\n' + '─'.repeat(60))
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
