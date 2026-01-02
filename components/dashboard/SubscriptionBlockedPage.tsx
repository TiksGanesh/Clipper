import Link from 'next/link'

type BlockReason = 'canceled' | 'expired' | 'trial_ended' | 'period_ended' | 'not_found' | 'past_due'

const messages: Record<BlockReason, { title: string; description: string }> = {
  canceled: {
    title: 'Account Suspended',
    description: 'Your shop account has been suspended. Please contact support for assistance.'
  },
  expired: {
    title: 'Subscription Expired',
    description: 'Your subscription has expired. Please renew your subscription to continue using the dashboard.'
  },
  trial_ended: {
    title: 'Trial Period Ended',
    description: 'Your trial period has ended. Please subscribe to continue managing your shop.'
  },
  period_ended: {
    title: 'Subscription Expired',
    description: 'Your subscription period has ended. Please renew to continue using the dashboard.'
  },
  not_found: {
    title: 'Subscription Not Found',
    description: 'No active subscription found for your shop. Please contact support.'
  },
  past_due: {
    title: 'Payment Required',
    description: 'Your payment is past due. Please update your payment method to restore access.'
  }
}

export default function SubscriptionBlockedPage({ reason }: { reason: BlockReason }) {
  const { title, description } = messages[reason]
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-md rounded-lg p-8 text-center">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
        <p className="text-gray-600 mb-6">{description}</p>
        <div className="space-y-3">
          <Link 
            href="/login" 
            className="block w-full bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
