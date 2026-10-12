import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  email?: string
  referral?: string | null
  submittedAt?: string
}

const AccessRequestAlert = ({ email, referral, submittedAt }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New AceMail access request from ${email ?? 'someone'}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>AceMail</Text>
        <Heading style={h1}>New access request</Heading>
        <Section style={card}>
          <Text style={label}>Email</Text>
          <Text style={value}>{email || 'Not provided'}</Text>
          <Text style={label}>Referred by</Text>
          <Text style={value}>{referral || 'None'}</Text>
          <Text style={label}>Submitted</Text>
          <Text style={value}>{submittedAt || 'Just now'}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccessRequestAlert,
  subject: (d: Record<string, any>) => `New access request: ${d['email'] ?? 'unknown'}`,
  displayName: 'Access request alert',
  to: 'priyanshu@acemail.online',
  previewData: { email: 'jane@company.com', referral: 'Alex', submittedAt: '12 Oct 2026, 18:48 UTC' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '520px' }
const eyebrow = { color: '#d9562b', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: 0 }
const h1 = { fontSize: '24px', color: '#1f1b18', margin: '6px 0 18px' }
const card = { border: '1px solid #eadfd6', borderRadius: '10px', padding: '6px 18px' }
const label = { fontSize: '12px', color: '#8a7f77', margin: '12px 0 2px' }
const value = { fontSize: '15px', color: '#1f1b18', margin: '0 0 6px' }
