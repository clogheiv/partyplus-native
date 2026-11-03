export type LocationDetails = {version:1;streetAddress:string;city:string;zipCode:string};
export const emptyLocationDetails = ():LocationDetails => ({version:1,streetAddress:'',city:'',zipCode:''});
type PartyLocation = {location?:string;address?:string;locationDetails?:LocationDetails|null};

// Legacy text remains whole. An explicit structured value, including an empty
// address, takes precedence without guessing components or reviving old text.
export function partyLocationText(party:PartyLocation):string {
 if(party.locationDetails)return [party.locationDetails.streetAddress,party.locationDetails.city,party.locationDetails.zipCode].map(value=>value.trim()).filter(Boolean).join(', ');
 return [party.location,party.address].filter((value,index,values)=>value?.trim()&&values.indexOf(value)===index).join(', ');
}

export function partyLocationMapAddress(party:PartyLocation):string {
 return party.locationDetails?partyLocationText(party):(party.address?.trim()||party.location?.trim()||'');
}
