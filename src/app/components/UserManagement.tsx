import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Snackbar,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Add, Visibility, VisibilityOff, People, Edit, Delete } from '@mui/icons-material';
import { api, ApiError, ManagedUser } from '../lib/api';
import { dialogContentSx, dialogActionsSx, standardInputProps } from '../styles/formStyles';

const CREATABLE_ROLES = ['Technician', 'Municipal Encoder'] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Department Head',
  technician: 'Technician',
  encoder: 'Municipal Encoder',
};

const ROLE_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info'> = {
  admin: 'primary',
  technician: 'success',
  encoder: 'info',
};

const ROLE_TO_FORM: Record<string, string> = {
  technician: 'Technician',
  encoder: 'Municipal Encoder',
};

const BARANGAYS = [
  'Bunog',
  'Campong Ulay',
  'Candawaga',
  'Canipaan',
  'Culasian',
  'Iraan',
  'Latud',
  'Panalingaan',
  'Punta Baja (Poblacion)',
  'Ransang',
  'Taburi',
];

const emptyForm = {
  fullName: '',
  email: '',
  office: '',
  municipality: '',
  role: 'Technician',
  password: '',
  confirmPassword: '',
};

export function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await api.getUsers());
    } catch {
      setSnack('Failed to load users');
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData(emptyForm);
    setError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setDialogOpen(true);
  };

  const handleOpenEdit = (user: ManagedUser) => {
    if (user.role === 'admin') {
      setSnack('Department Head accounts cannot be edited here');
      return;
    }
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      office: user.office || '',
      municipality: user.municipality || '',
      role: ROLE_TO_FORM[user.role] || 'Technician',
      password: '',
      confirmPassword: '',
    });
    setError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setDialogOpen(true);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSave = async () => {
    setError('');

    if (!formData.fullName || !formData.email || !formData.role) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.role === 'Technician' && !formData.municipality) {
      setError('Technicians must be assigned to a barangay');
      return;
    }

    const isCreate = !editingUser;
    if (isCreate && !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password || formData.confirmPassword) {
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        office: formData.office.trim() || 'Department of Agriculture - Rizal',
        municipality: formData.municipality || undefined,
        role: formData.role,
        password: formData.password || undefined,
      };

      if (editingUser) {
        await api.updateUser(editingUser.id, payload);
        setSnack('Account updated successfully');
      } else {
        await api.createUser({
          ...payload,
          password: formData.password,
        });
        setSnack('Account created successfully');
      }
      setDialogOpen(false);
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : editingUser
            ? 'Failed to update account'
            : 'Failed to create account'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    if (user.role === 'admin') {
      setSnack('Department Head accounts cannot be deleted here');
      return;
    }
    if (
      !confirm(
        `Delete account for ${user.fullName} (${ROLE_LABELS[user.role] || user.role})? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await api.deleteUser(user.id);
      await loadUsers();
      setSnack('Account deleted successfully');
    } catch (err) {
      setSnack(err instanceof ApiError ? err.message : 'Failed to delete account');
    }
  };

  const isEditable = (user: ManagedUser) => user.role === 'technician' || user.role === 'encoder';

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create, update, and remove technicians (per barangay) and municipal encoders.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenCreate}>
          Create Account
        </Button>
      </Box>

      <Paper sx={{ mb: 2, p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <People color="primary" />
        <Typography variant="body2" color="text.secondary">
          {users.length} account{users.length === 1 ? '' : 's'} · Field staff sign in with the credentials you
          provide here.
        </Typography>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Full Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Office</TableCell>
              <TableCell>Barangay</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No accounts yet. Create a technician account to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={ROLE_LABELS[user.role] || user.role}
                      color={ROLE_COLORS[user.role] || 'default'}
                    />
                  </TableCell>
                  <TableCell>{user.office || '—'}</TableCell>
                  <TableCell>{user.municipality || '—'}</TableCell>
                  <TableCell align="right">
                    {isEditable(user) ? (
                      <>
                        <IconButton size="small" color="primary" onClick={() => handleOpenEdit(user)} aria-label="Edit">
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => void handleDelete(user)} aria-label="Delete">
                          <Delete fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? 'Edit User Account' : 'Create User Account'}</DialogTitle>
        <DialogContent sx={dialogContentSx}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Full Name"
            required
            margin="normal"
            value={formData.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            {...standardInputProps}
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            required
            margin="normal"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            {...standardInputProps}
          />
          <TextField
            fullWidth
            label="Office / Organization"
            margin="normal"
            value={formData.office}
            onChange={(e) => handleChange('office', e.target.value)}
            {...standardInputProps}
          />
          <TextField
            fullWidth
            select
            label="Assigned Barangay"
            required={formData.role === 'Technician'}
            margin="normal"
            value={formData.municipality}
            onChange={(e) => handleChange('municipality', e.target.value)}
            helperText={
              formData.role === 'Technician'
                ? 'Required — technician is designated to this barangay'
                : 'Optional for municipal encoders'
            }
            {...standardInputProps}
          >
            <MenuItem value="">None</MenuItem>
            {BARANGAYS.map((b) => (
              <MenuItem key={b} value={b}>
                {b}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            select
            label="Role"
            required
            margin="normal"
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value)}
            {...standardInputProps}
          >
            {CREATABLE_ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label={editingUser ? 'New Password (optional)' : 'Password'}
            type={showPassword ? 'text' : 'password'}
            required={!editingUser}
            margin="normal"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            helperText={editingUser ? 'Leave blank to keep the current password' : undefined}
            InputLabelProps={standardInputProps.InputLabelProps}
            sx={standardInputProps.sx}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            label={editingUser ? 'Confirm New Password' : 'Confirm Password'}
            type={showConfirmPassword ? 'text' : 'password'}
            required={!editingUser || !!formData.password}
            margin="normal"
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            InputLabelProps={standardInputProps.InputLabelProps}
            sx={standardInputProps.sx}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={dialogActionsSx}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleSave()} disabled={submitting}>
            {submitting
              ? editingUser
                ? 'Saving...'
                : 'Creating...'
              : editingUser
                ? 'Save Changes'
                : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" onClose={() => setSnack('')}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  );
}
