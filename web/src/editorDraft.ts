import type {PartyItem} from '../../src/lib/partyTypes';

// The text being entered is part of the durable draft, not a separate UI-only
// buffer. Both Add and Save consume it through the same operation.
export function includePendingItem<T extends {items?:PartyItem[];pendingItemName?:string;pendingItemQty?:string;pendingItemId?:string}>(draft:T,allocate:()=>string):T {
 const name=draft.pendingItemName?.trim();
 if(!name)return draft;
 const id=draft.pendingItemId || allocate();
 const items=draft.items??[];
 return {...draft,items:items.some(item=>item.id===id)?items:[...items,{id,name,qty:draft.pendingItemQty?.trim()||''}],pendingItemName:'',pendingItemQty:'',pendingItemId:undefined};
}

// Google Maps universal URLs need no API key or paid integration. They open the
// installed map app when supported and otherwise a browser map.
export function partyMapLinks(location?:string,address?:string) {
 const place=address?.trim() || location?.trim();
 if(!place)return null;
 const query=encodeURIComponent(place);
 return {map:`https://www.google.com/maps/search/?api=1&query=${query}`,directions:`https://www.google.com/maps/dir/?api=1&destination=${query}`};
}
