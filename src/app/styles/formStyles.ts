import { SxProps, Theme } from '@mui/material';

export const formSectionHeaderSx: SxProps<Theme> = {
  mb: 2,
  mt: 2,
  fontWeight: 600,
  color: 'text.secondary'
};

export const formGridContainerSx: SxProps<Theme> = {
  mt: 2,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 2,
  '& .MuiGrid-root': {
    paddingLeft: 0,
    paddingTop: 0
  },
  '& .MuiTextField-root': {
    minWidth: 'auto',
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      transition: 'all 0.2s ease',
      minHeight: '56px',
      bgcolor: '#fff',
      '&:hover': {
        bgcolor: '#f8fdf9',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#4caf50'
        }
      },
      '&.Mui-focused': {
        bgcolor: '#fff',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#2e7d32',
          borderWidth: '2px'
        }
      }
    },
    '& .MuiInputLabel-root': {
      fontWeight: 500,
      fontSize: '1rem',
      whiteSpace: 'nowrap',
      overflow: 'visible',
      textOverflow: 'clip',
      '&.Mui-focused': {
        color: '#2e7d32'
      }
    },
    '& .MuiSelect-select': {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      paddingRight: '32px !important',
      minWidth: '120px'
    },
    '& .MuiInputBase-input': {
      fontSize: '0.95rem',
      padding: '16.5px 14px'
    },
    '& .MuiFormHelperText-root': {
      marginLeft: 0,
      marginTop: '4px',
      fontSize: '0.75rem',
      color: '#666'
    }
  }
};

export const autoWidthInputSx: SxProps<Theme> = {
  minWidth: '140px',
  width: 'auto',
  '& .MuiInputBase-root': {
    width: 'auto'
  }
};

export const dialogContentSx: SxProps<Theme> = {
  pt: 3,
  pb: 2,
  px: 3,
  overflowY: 'auto',
  maxHeight: 'calc(100vh - 200px)',
  bgcolor: '#fafafa'
};

export const dialogActionsSx: SxProps<Theme> = {
  px: 3,
  py: 2,
  gap: 1
};

export const standardInputProps = {
  InputLabelProps: {
    shrink: true,
    sx: {
      fontSize: '1rem',
      fontWeight: 500,
      '&.MuiInputLabel-shrink': {
        transform: 'translate(14px, -9px) scale(0.75)'
      },
      '&.Mui-focused': {
        color: '#2e7d32'
      }
    }
  },
  sx: {
    '& .MuiOutlinedInput-notchedOutline legend': {
      maxWidth: '100%'
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      bgcolor: '#fff',
      transition: 'all 0.2s ease',
      '&:hover': {
        bgcolor: '#f8fdf9',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#4caf50'
        }
      },
      '&.Mui-focused': {
        bgcolor: '#fff',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#2e7d32',
          borderWidth: '2px'
        }
      },
      '& input': {
        padding: '16.5px 14px'
      }
    },
    '& input[type="date"]': {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '0.95rem',
      padding: '16.5px 14px',
      colorScheme: 'light',
      '&::-webkit-calendar-picker-indicator': {
        cursor: 'pointer'
      },
      '&::-webkit-datetime-edit-text': {
        padding: '0 2px'
      },
      '&::-webkit-datetime-edit-month-field': {
        textTransform: 'none'
      },
      '&::-webkit-datetime-edit-day-field': {
        textTransform: 'none'
      },
      '&::-webkit-datetime-edit-year-field': {
        textTransform: 'none'
      }
    },
    '& .MuiInputBase-input': {
      height: 'auto',
      padding: '16.5px 14px'
    },
    '& .MuiSelect-select': {
      minWidth: '100% !important',
      boxSizing: 'border-box',
    },
    '& .MuiFormHelperText-root': {
      marginLeft: 0,
      marginTop: '4px',
      fontSize: '0.75rem',
      color: '#666'
    }
  }
};
