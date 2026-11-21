import { describe, expect, it } from 'vitest';
import { BOLD_END as E, BOLD_START as B, polishWillClauseText as polish } from './willTextPolish.js';

const plain = (s) => s.replace(/[]/g, '');

describe('polishWillClauseText', () => {
  it('removes the duplicated net estate fragment, even across bold markers', () => {
    expect(plain(polish(`I give ${B}a minimum amount of £50,000 of my net estate${E} of my net estate to X.`)))
      .toBe('I give a minimum amount of £50,000 of my net estate to X.');
  });

  it('fixes the join between template and client answer', () => {
    expect(plain(polish(`I wish ${B}My ashes are to be scattered at the Crematorium.${E}. I request that…`)))
      .toBe('I wish my ashes are to be scattered at the Crematorium. I request that….');
  });

  it('moves relationships after the name', () => {
    expect(plain(polish(`I appoint ${B}Friend Mr Felix Flint${E} of 77 Row, London, and ${B}Accountant Harriet Morgan${E} of Unit 4.`)))
      .toBe('I appoint Mr Felix Flint (my friend) of 77 Row, London, and Harriet Morgan (my accountant) of Unit 4.');
    expect(plain(polish('I request that my Friend Ms Penny Parker of 1 Lane care for my pets.')))
      .toBe('I request that Ms Penny Parker (my friend) of 1 Lane care for my pets.');
    expect(plain(polish(`I request that my ${B}Friend Ms Penny Parker${E} of 1 Lane care for my pets.`)))
      .toBe('I request that Ms Penny Parker (my friend) of 1 Lane care for my pets.');
  });

  it('drops a dangling "my" before a title', () => {
    expect(plain(polish('I hereby release and forgive my Mr Darren Debtor of 13 Street from any debts.')))
      .toBe('I hereby release and forgive Mr Darren Debtor of 13 Street from any debts.');
  });

  it('splits run-on appointments and gifts into sentences', () => {
    expect(plain(polish('to be the guardian(s) of Leo (date of birth 10/03/2020) I appoint Mr Rowan Blake to be the guardian(s) of Maya')))
      .toBe('to be the guardian(s) of Leo (date of birth 10/03/2020). I appoint Mr Rowan Blake to be the guardian(s) of Maya.');
    expect(plain(polish('Kept at: my home in the safe I give my paintings to Maya.')))
      .toBe('Kept at: my home in the safe. I give my paintings to Maya.');
  });

  it('leaves normal sentences alone', () => {
    const s = 'I give the property which I give to my Trustees to hold upon trust.';
    expect(plain(polish(s))).toBe(s);
    expect(plain(polish('I appoint Mr David Day of 101 Lane to be the Executor(s) and Trustee(s) of my estate.')))
      .toBe('I appoint Mr David Day of 101 Lane to be the Executor(s) and Trustee(s) of my estate.');
  });
});
