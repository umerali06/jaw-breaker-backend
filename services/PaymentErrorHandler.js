import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY && 
  process.env.STRIPE_SECRET_KEY !== "sk_test_your_stripe_secret_key_here"
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

/**
 * Comprehensive Payment Error Handling Service
 * Handles all payment-related errors with user-friendly messages and recovery actions
 */
class PaymentErrorHandler {
  constructor() {
    this.errorTypes = {
      CARD_DECLINED: 'card_declined',
      INSUFFICIENT_FUNDS: 'insufficient_funds',
      EXPIRED_CARD: 'expired_card',
      INCORRECT_CVC: 'incorrect_cvc',
      PROCESSING_ERROR: 'processing_error',
      RATE_LIMIT: 'rate_limit',
      INVALID_REQUEST: 'invalid_request',
      AUTHENTICATION_REQUIRED: 'authentication_required',
      NETWORK_ERROR: 'network_error',
      UNKNOWN_ERROR: 'unknown_error'
    };

    this.recoveryActions = {
      RETRY: 'retry',
      CHANGE_PAYMENT_METHOD: 'change_payment_method',
      CONTACT_SUPPORT: 'contact_support',
      WAIT_AND_RETRY: 'wait_and_retry',
      VERIFY_IDENTITY: 'verify_identity'
    };
  }

  /**
   * Handle Stripe errors with comprehensive error mapping
   */
  handleStripeError(error) {
    console.error('💳 Stripe Error:', {
      type: error.type,
      code: error.code,
      message: error.message,
      decline_code: error.decline_code
    });

    const errorInfo = {
      originalError: error,
      type: this.errorTypes.UNKNOWN_ERROR,
      userMessage: 'An unexpected error occurred. Please try again.',
      recoveryAction: this.recoveryActions.CONTACT_SUPPORT,
      retryable: false,
      statusCode: 500
    };

    // Handle specific Stripe error types
    switch (error.type) {
      case 'StripeCardError':
        return this.handleCardError(error);
      
      case 'StripeRateLimitError':
        return this.handleRateLimitError(error);
      
      case 'StripeInvalidRequestError':
        return this.handleInvalidRequestError(error);
      
      case 'StripeAuthenticationError':
        return this.handleAuthenticationError(error);
      
      case 'StripeAPIError':
        return this.handleAPIError(error);
      
      case 'StripeConnectionError':
        return this.handleConnectionError(error);
      
      default:
        return errorInfo;
    }
  }

  /**
   * Handle card-specific errors
   */
  handleCardError(error) {
    const declineCode = error.decline_code;
    const code = error.code;

    // Map decline codes to user-friendly messages
    const declineCodeMap = {
      'generic_decline': {
        message: 'Your card was declined. Please try a different payment method.',
        action: this.recoveryActions.CHANGE_PAYMENT_METHOD
      },
      'insufficient_funds': {
        message: 'Your card has insufficient funds. Please try a different payment method or add funds to your account.',
        action: this.recoveryActions.CHANGE_PAYMENT_METHOD
      },
      'lost_card': {
        message: 'Your card was declined because it has been reported as lost. Please contact your bank.',
        action: this.recoveryActions.CONTACT_SUPPORT
      },
      'stolen_card': {
        message: 'Your card was declined because it has been reported as stolen. Please contact your bank.',
        action: this.recoveryActions.CONTACT_SUPPORT
      },
      'expired_card': {
        message: 'Your card has expired. Please use a different payment method.',
        action: this.recoveryActions.CHANGE_PAYMENT_METHOD
      },
      'incorrect_cvc': {
        message: 'The security code (CVC) you entered is incorrect. Please check and try again.',
        action: this.recoveryActions.RETRY
      },
      'processing_error': {
        message: 'There was an error processing your card. Please try again.',
        action: this.recoveryActions.RETRY
      },
      'try_again_later': {
        message: 'Your card was declined. Please try again in a few minutes.',
        action: this.recoveryActions.WAIT_AND_RETRY
      },
      'withdraw_count_limit_exceeded': {
        message: 'You have exceeded the maximum number of attempts. Please try again later.',
        action: this.recoveryActions.WAIT_AND_RETRY
      }
    };

    const errorInfo = declineCodeMap[declineCode] || {
      message: 'Your card was declined. Please try a different payment method.',
      action: this.recoveryActions.CHANGE_PAYMENT_METHOD
    };

    return {
      type: this.errorTypes.CARD_DECLINED,
      userMessage: errorInfo.message,
      recoveryAction: errorInfo.action,
      retryable: errorInfo.action === this.recoveryActions.RETRY || errorInfo.action === this.recoveryActions.WAIT_AND_RETRY,
      statusCode: 400,
      declineCode: declineCode,
      suggestions: this.getCardErrorSuggestions(declineCode)
    };
  }

  /**
   * Handle rate limit errors
   */
  handleRateLimitError(error) {
    return {
      type: this.errorTypes.RATE_LIMIT,
      userMessage: 'Too many requests. Please wait a moment and try again.',
      recoveryAction: this.recoveryActions.WAIT_AND_RETRY,
      retryable: true,
      statusCode: 429,
      retryAfter: 60, // seconds
      suggestions: [
        'Wait 1-2 minutes before trying again',
        'Check your internet connection',
        'Contact support if the issue persists'
      ]
    };
  }

  /**
   * Handle invalid request errors
   */
  handleInvalidRequestError(error) {
    const code = error.code;
    
    const codeMap = {
      'parameter_invalid_empty': {
        message: 'Please fill in all required fields.',
        action: this.recoveryActions.RETRY
      },
      'parameter_invalid_string_empty': {
        message: 'Please provide a valid value for all fields.',
        action: this.recoveryActions.RETRY
      },
      'parameter_missing': {
        message: 'Some required information is missing. Please check your form.',
        action: this.recoveryActions.RETRY
      },
      'parameter_unknown': {
        message: 'Invalid request. Please refresh the page and try again.',
        action: this.recoveryActions.RETRY
      }
    };

    const errorInfo = codeMap[code] || {
      message: 'Invalid request. Please check your information and try again.',
      action: this.recoveryActions.RETRY
    };

    return {
      type: this.errorTypes.INVALID_REQUEST,
      userMessage: errorInfo.message,
      recoveryAction: errorInfo.action,
      retryable: true,
      statusCode: 400,
      suggestions: [
        'Check all form fields are filled correctly',
        'Refresh the page and try again',
        'Contact support if the issue persists'
      ]
    };
  }

  /**
   * Handle authentication errors
   */
  handleAuthenticationError(error) {
    return {
      type: this.errorTypes.AUTHENTICATION_REQUIRED,
      userMessage: 'Authentication required. Please refresh the page and try again.',
      recoveryAction: this.recoveryActions.RETRY,
      retryable: true,
      statusCode: 401,
      suggestions: [
        'Refresh the page',
        'Clear your browser cache',
        'Try logging in again'
      ]
    };
  }

  /**
   * Handle API errors
   */
  handleAPIError(error) {
    return {
      type: this.errorTypes.PROCESSING_ERROR,
      userMessage: 'Payment processing is temporarily unavailable. Please try again in a few minutes.',
      recoveryAction: this.recoveryActions.WAIT_AND_RETRY,
      retryable: true,
      statusCode: 503,
      suggestions: [
        'Wait a few minutes and try again',
        'Check our status page for updates',
        'Contact support if the issue persists'
      ]
    };
  }

  /**
   * Handle connection errors
   */
  handleConnectionError(error) {
    return {
      type: this.errorTypes.NETWORK_ERROR,
      userMessage: 'Network connection error. Please check your internet connection and try again.',
      recoveryAction: this.recoveryActions.RETRY,
      retryable: true,
      statusCode: 503,
      suggestions: [
        'Check your internet connection',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ]
    };
  }

  /**
   * Get specific suggestions for card errors
   */
  getCardErrorSuggestions(declineCode) {
    const suggestions = {
      'generic_decline': [
        'Try a different payment method',
        'Contact your bank to ensure the card is active',
        'Check that billing information matches your card'
      ],
      'insufficient_funds': [
        'Add funds to your account',
        'Try a different payment method',
        'Contact your bank for assistance'
      ],
      'expired_card': [
        'Use a different payment method',
        'Update your card information if it has been renewed'
      ],
      'incorrect_cvc': [
        'Check the 3-digit code on the back of your card',
        'For American Express, use the 4-digit code on the front'
      ],
      'processing_error': [
        'Try again in a few moments',
        'Use a different payment method',
        'Contact support if the issue persists'
      ]
    };

    return suggestions[declineCode] || [
      'Try a different payment method',
      'Contact your bank for assistance',
      'Contact support if the issue persists'
    ];
  }

  /**
   * Handle general payment errors
   */
  handlePaymentError(error, context = {}) {
    console.error('💳 Payment Error:', {
      error: error.message,
      context: context,
      stack: error.stack
    });

    // If it's a Stripe error, use Stripe error handling
    if (error.type && error.type.startsWith('Stripe')) {
      return this.handleStripeError(error);
    }

    // Handle network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        type: this.errorTypes.NETWORK_ERROR,
        userMessage: 'Network connection error. Please check your internet connection and try again.',
        recoveryAction: this.recoveryActions.RETRY,
        retryable: true,
        statusCode: 503,
        suggestions: [
          'Check your internet connection',
          'Try again in a few moments',
          'Contact support if the issue persists'
        ]
      };
    }

    // Handle timeout errors
    if (error.code === 'ETIMEDOUT') {
      return {
        type: this.errorTypes.NETWORK_ERROR,
        userMessage: 'Request timed out. Please try again.',
        recoveryAction: this.recoveryActions.RETRY,
        retryable: true,
        statusCode: 408,
        suggestions: [
          'Try again in a few moments',
          'Check your internet connection',
          'Contact support if the issue persists'
        ]
      };
    }

    // Default error handling
    return {
      type: this.errorTypes.UNKNOWN_ERROR,
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      recoveryAction: this.recoveryActions.CONTACT_SUPPORT,
      retryable: false,
      statusCode: 500,
      suggestions: [
        'Try again in a few moments',
        'Contact support if the issue persists',
        'Check our status page for updates'
      ]
    };
  }

  /**
   * Create user-friendly error response
   */
  createErrorResponse(errorInfo, additionalData = {}) {
    const response = {
      success: false,
      error: errorInfo.userMessage,
      errorType: errorInfo.type,
      recoveryAction: errorInfo.recoveryAction,
      retryable: errorInfo.retryable,
      userFriendly: {
        title: this.getErrorTitle(errorInfo.type),
        message: errorInfo.userMessage,
        suggestions: errorInfo.suggestions || [],
        contactSupport: errorInfo.recoveryAction === this.recoveryActions.CONTACT_SUPPORT
      }
    };

    // Add additional data
    if (errorInfo.retryAfter) {
      response.retryAfter = errorInfo.retryAfter;
    }

    if (errorInfo.declineCode) {
      response.declineCode = errorInfo.declineCode;
    }

    if (additionalData.clientSecret) {
      response.clientSecret = additionalData.clientSecret;
    }

    if (additionalData.requiresAction) {
      response.requiresAction = additionalData.requiresAction;
    }

    return response;
  }

  /**
   * Get error title based on error type
   */
  getErrorTitle(errorType) {
    const titles = {
      [this.errorTypes.CARD_DECLINED]: 'Payment Declined',
      [this.errorTypes.INSUFFICIENT_FUNDS]: 'Insufficient Funds',
      [this.errorTypes.EXPIRED_CARD]: 'Card Expired',
      [this.errorTypes.INCORRECT_CVC]: 'Invalid Security Code',
      [this.errorTypes.PROCESSING_ERROR]: 'Processing Error',
      [this.errorTypes.RATE_LIMIT]: 'Too Many Requests',
      [this.errorTypes.INVALID_REQUEST]: 'Invalid Request',
      [this.errorTypes.AUTHENTICATION_REQUIRED]: 'Authentication Required',
      [this.errorTypes.NETWORK_ERROR]: 'Connection Error',
      [this.errorTypes.UNKNOWN_ERROR]: 'Unexpected Error'
    };

    return titles[errorType] || 'Payment Error';
  }

  /**
   * Log error for monitoring and debugging
   */
  logError(error, errorInfo, context = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      errorType: errorInfo.type,
      userMessage: errorInfo.userMessage,
      recoveryAction: errorInfo.recoveryAction,
      retryable: errorInfo.retryable,
      context: context,
      originalError: {
        message: error.message,
        type: error.type,
        code: error.code,
        decline_code: error.decline_code
      }
    };

    console.error('💳 Payment Error Log:', logData);
    
    // TODO: Send to monitoring service (e.g., Sentry, DataDog)
    // this.sendToMonitoringService(logData);
  }
}

export default new PaymentErrorHandler();
