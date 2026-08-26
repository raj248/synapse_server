export const getVerificationEmailHtml = (token: string): string => `
  <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
    <h2>Welcome to Synapse!</h2>
    <p>Please verify your email address to complete your registration.</p>
    <div style="margin: 20px 0;">
      <a href="https://synapse.app/verify-email?token=${token}" 
         style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Verify Email Address
      </a>
    </div>
    <p style="font-size: 12px; color: #666;">If you didn't create an account, you can safely ignore this email.</p>
  </div>
`;

export const getResetPasswordEmailHtml = (code: string): string => `
  <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
    <h2>Reset Your Password</h2>
    <p>Use the 6-digit code below to reset your Synapse account password:</p>
    <div style="background-color: #F3F4F6; padding: 16px; font-size: 28px; font-weight: bold; letter-spacing: 4px; text-align: center; border-radius: 8px; width: 200px; margin: 20px 0;">
      ${code}
    </div>
    <p>This code will expire in <strong>15 minutes</strong>.</p>
  </div>
`;
