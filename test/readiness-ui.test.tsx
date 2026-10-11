import {useState} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {DataProvider} from '../src/context/DataContext';
const store=vi.hoisted(()=>{
  let state={decks:[],cards:[],loading:false,error:null as string|null,status:'',halted:false,busy:false,version:1};
  const listeners=new Set<()=>void>();
  return {start:vi.fn(),snapshot:()=>state,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},update:(patch:Partial<typeof state>)=>{state={...state,...patch};listeners.forEach(fn=>fn());}};
});
vi.mock('../src/data/house',()=>({dataStore:store}));
afterEach(cleanup);
it('preserves mounted unsaved input when bindings disappear and return',()=>{
  function Draft(){const [text,setText]=useState('');return <input aria-label="Card draft" value={text} onChange={event=>setText(event.target.value)}/>;}
  render(<DataProvider><Draft/></DataProvider>);
  const input=screen.getByLabelText('Card draft') as HTMLInputElement;
  fireEvent.change(input,{target:{value:'Keep both sides'}});
  act(()=>store.update({error:'Bind exactly one Flashcards Room'}));
  expect(input.value).toBe('Keep both sides');expect(input.closest('[hidden]')).not.toBeNull();
  act(()=>store.update({error:null}));
  expect(screen.getByLabelText('Card draft')).toBe(input);expect(input.value).toBe('Keep both sides');expect(input.closest('[hidden]')).toBeNull();
});
it('keeps local editing available and describes a Provider halt accurately',()=>{
  act(()=>store.update({error:null,halted:true}));
  render(<DataProvider><input aria-label="Local edit"/></DataProvider>);
  expect(screen.getByText('Changes stay saved locally while House synchronization is paused.')).toBeTruthy();
  const input=screen.getByLabelText('Local edit') as HTMLInputElement;
  expect(input.disabled).toBe(false);expect(input.closest('[hidden]')).toBeNull();
  fireEvent.change(input,{target:{value:'Still local'}});expect(input.value).toBe('Still local');
  act(()=>store.update({error:'Access refused'}));
  expect(screen.getAllByText('Access refused').length).toBeGreaterThan(0);
  expect(screen.queryByText('Changes stay saved locally while House synchronization is paused.')).toBeNull();
});
