import { useNavigate } from 'react-router-dom'
import { Button, Stack, Heading, Text } from '../ui'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <Stack gap={4} align="start" className="py-16">
      <Heading level={1} className="text-3xl">Page not found</Heading>
      <Text tone="muted">That route doesn’t exist. Let’s get you back on track.</Text>
      <Button variant="primary" onClick={() => navigate('/')}>Go to dashboard</Button>
    </Stack>
  )
}
