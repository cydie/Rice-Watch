import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, CircularProgress, TextField, Typography } from '@mui/material';
import { api, FarmerApi } from '../lib/api';
import { standardInputProps } from '../styles/formStyles';
import { useAuth } from '../context/AuthContext';

type Props = {
  barangay: string;
  value: string;
  onChange: (farmerName: string, farmer?: FarmerApi | null) => void;
  disabled?: boolean;
  required?: boolean;
  sx?: object;
};

function farmerLabel(f: FarmerApi) {
  return f.fullName?.trim() || [f.firstName, f.middleName, f.lastName, f.suffix].filter(Boolean).join(' ');
}

export function FarmerNameSelect({
  barangay,
  value,
  onChange,
  disabled = false,
  required = true,
  sx,
}: Props) {
  const { user } = useAuth();
  const canRegisterFarmers = user?.role === 'admin' || user?.role === 'encoder';
  const [farmers, setFarmers] = useState<FarmerApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    if (!barangay) {
      setFarmers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void api
      .getFarmers({ barangay, page: 1, limit: 2000 })
      .then((res) => {
        if (!cancelled) setFarmers(res.data);
      })
      .catch(() => {
        if (!cancelled) setFarmers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [barangay]);

  const selected = useMemo(() => {
    if (!value) return null;
    return farmers.find((f) => farmerLabel(f).toLowerCase() === value.toLowerCase()) || null;
  }, [farmers, value]);

  const helperText = !barangay
    ? 'Select a barangay first'
    : loading
      ? 'Loading farmers…'
      : farmers.length === 0
        ? canRegisterFarmers
          ? `No farmers registered in ${barangay}. Register them under Farmers Data first.`
          : `No farmers registered in ${barangay}. Ask the Department Head or Municipal Encoder to register the farmer first.`
        : `Search ${farmers.length} registered farmer${farmers.length === 1 ? '' : 's'} in ${barangay}`;

  return (
    <Autocomplete
      options={farmers}
      loading={loading}
      disabled={disabled || !barangay}
      value={selected}
      inputValue={inputValue}
      onInputChange={(_e, next, reason) => {
        if (reason === 'input' || reason === 'clear') setInputValue(next);
      }}
      onChange={(_e, farmer) => {
        const name = farmer ? farmerLabel(farmer) : '';
        setInputValue(name);
        onChange(name, farmer);
      }}
      getOptionLabel={(option) => farmerLabel(option)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(options, state) => {
        const q = state.inputValue.trim().toLowerCase();
        if (!q) return options;
        return options.filter((f) => {
          const label = farmerLabel(f).toLowerCase();
          return (
            label.includes(q) ||
            f.rsbsaNumber.toLowerCase().includes(q) ||
            f.lastName.toLowerCase().includes(q) ||
            f.firstName.toLowerCase().includes(q)
          );
        });
      }}
      noOptionsText={
        loading
          ? 'Loading…'
          : farmers.length === 0
            ? 'No registered farmers for this barangay'
            : 'No matching farmer'
      }
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <div>
            <Typography variant="body2">{farmerLabel(option)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {option.rsbsaNumber ? `RSBSA ${option.rsbsaNumber}` : 'No RSBSA'} · {option.barangay}
            </Typography>
          </div>
        </li>
      )}
      sx={{ minWidth: 240, flex: 2, ...sx }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Name of Farmer"
          required={required}
          helperText={helperText}
          error={Boolean(barangay) && !loading && farmers.length === 0}
          InputLabelProps={{
            ...params.InputLabelProps,
            ...standardInputProps.InputLabelProps,
            shrink: true,
          }}
          sx={standardInputProps.sx}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
