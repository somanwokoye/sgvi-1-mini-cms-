import UserSearchBody from "./userSearchBody.interface";

export default interface UserSearchResult {
  hits?: { //For search use with match or multi-match
    total: number;
    hits: Array<{
      _source: UserSearchBody;
    }>;
  };
  suggest?: { //for suggest use. define for each suggest in mapping
    suggestFullNameWithWeights?: [{ //I am using only this for illustration. I figured out these fields from the JSON output
      text: string,
      offset: number,
      length: number,
      options: [
        {
          text: string, //the text that was sent as search string
          _score: number, //score for suggestion. Useful for order by
          /* all below commented out are in the suggest result but we don't really need to keep track of them in our codes, hence I commented them out. I left them here for awareness sake.
          _index: string, //name of the index that was searched; users in this case.
          _type: string, //e.g. _doc as indicated by elastic search
          _id: string, //likely the id of the index. Need to confirm
          */
          //below are the fields that were indexed and correspond to the suggestion option. This data is needed for selection.
          _source: UserSearchBody
        }
      ]
    }],
    suggestFullName?: [{ //I am using only this for illustration. I figured out these fields from the JSON output
      text: string,
      offset: number,
      length: number,
      options: [
        {
          text: string, //the text that was sent as search string
          _score: number, //score for suggestion. Useful for order by
          /* all below commented out are in the suggest result but we don't really need to keep track of them in our codes, hence I commented them out. I left them here for awareness sake.
          _index: string, //name of the index that was searched; users in this case.
          _type: string, //e.g. _doc as indicated by elastic search
          _id: string, //likely the id of the index. Need to confirm
          */
          //below are the fields that were indexed and correspond to the suggestion option. This data is needed for selection.
          _source: UserSearchBody
        }
      ]
      
    }],
    suggestFirstName?: [{ //I am using only this for illustration. I figured out these fields from the JSON output
      text: string,
      offset: number,
      length: number,
      options: [
        {
          text: string, //the text that was sent as search string
          _score: number, //score for suggestion. Useful for order by
          /* all below commented out are in the suggest result but we don't really need to keep track of them in our codes, hence I commented them out. I left them here for awareness sake.
          _index: string, //name of the index that was searched; users in this case.
          _type: string, //e.g. _doc as indicated by elastic search
          _id: string, //likely the id of the index. Need to confirm
          */
          //below are the fields that were indexed and correspond to the suggestion option. This data is needed for selection.
          _source: UserSearchBody
        }
      ],
      
    }],
    suggestLastName?: [{ //I am using only this for illustration. I figured out these fields from the JSON output
      text: string,
      offset: number,
      length: number,
      options: [
        {
          text: string, //the text that was sent as search string
          _score: number, //score for suggestion. Useful for order by
          /* all below commented out are in the suggest result but we don't really need to keep track of them in our codes, hence I commented them out. I left them here for awareness sake.
          _index: string, //name of the index that was searched; users in this case.
          _type: string, //e.g. _doc as indicated by elastic search
          _id: string, //likely the id of the index. Need to confirm
          */
          //below are the fields that were indexed and correspond to the suggestion option. This data is needed for selection.
          _source: UserSearchBody
        }
      ],
      
    }]
  }
}