export interface College {
  id: string;
  name: string;
  domain: string;
}

export const SUPPORTED_COLLEGES: College[] = [
  {
    id: 'gla',
    name: 'GLA University',
    domain: 'gla.ac.in'
  },
  {
    id: 'mit',
    name: 'MIT',
    domain: 'mit.edu'
  },
  {
    id: 'other',
    name: 'Other (Demo)',
    domain: 'gmail.com'
  }
];

export const validateEmailDomain = (email: string, collegeId: string): boolean => {
  const college = SUPPORTED_COLLEGES.find(c => c.id === collegeId);
  if (!college) return false;
  
  const emailDomain = email.split('@')[1];
  return emailDomain === college.domain;
};
