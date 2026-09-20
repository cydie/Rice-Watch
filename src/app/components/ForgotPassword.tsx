import { useState } from 'react';
import { TextField, Button, Paper, Typography, Box, Alert, IconButton } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { api, ApiError } from '../lib/api';

interface ForgotPasswordProps {
  onNavigateToLogin: () => void;
}

export function ForgotPassword({ onNavigateToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.forgotPassword(email.trim().toLowerCase());
      setSuccess(
        res.demoOtp
          ? `${res.message} (Demo OTP: ${res.demoOtp})`
          : res.message
      );
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    setSubmitting(true);
    try {
      await api.verifyOtp(email.trim().toLowerCase(), otp);
      setSuccess('OTP verified successfully');
      setStep('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(email.trim().toLowerCase(), otp, newPassword);
      setSuccess('Password reset successful!');
      setTimeout(() => onNavigateToLogin(), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)',
        p: { xs: 2, sm: 3 },
      }}
    >
      <Paper elevation={8} sx={{ p: { xs: 3, sm: 4 }, maxWidth: 450, width: '100%', borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={onNavigateToLogin} sx={{ mr: 1 }} aria-label="back">
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" fontWeight="bold" color="primary">
            Reset Password
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter your email address and we&apos;ll send you an OTP to reset your password.
            </Typography>

            <TextField
              fullWidth
              label="Email Address"
              variant="outlined"
              margin="normal"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={submitting}
              sx={{ mt: 3, py: 1.5, background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
            >
              {submitting ? 'Sending...' : 'Send OTP'}
            </Button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the 6-digit OTP sent to {email}
            </Typography>

            <TextField
              fullWidth
              label="Enter OTP"
              variant="outlined"
              margin="normal"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputProps={{ maxLength: 6 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={submitting}
              sx={{ mt: 3, py: 1.5, background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
            >
              {submitting ? 'Verifying...' : 'Verify OTP'}
            </Button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handlePasswordReset}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create a new password for your account
            </Typography>

            <TextField
              fullWidth
              label="New Password"
              variant="outlined"
              margin="normal"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <TextField
              fullWidth
              label="Confirm New Password"
              variant="outlined"
              margin="normal"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={submitting}
              sx={{ mt: 3, py: 1.5, background: 'linear-gradient(45deg, #2e7d32 30%, #66bb6a 90%)' }}
            >
              {submitting ? 'Saving...' : 'Reset Password'}
            </Button>
          </form>
        )}
      </Paper>
    </Box>
  );
}
