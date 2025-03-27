/*Below is type definition for our context type.*/
//Restricts Context type to null or Object containing functions; null is used only for initialization of context in App.
//Using Object because we have two or more parameters to pass and we want to carry them together within one context instead of two

import React from "react";
import { IAction } from "../global/app.interfaces";

//different ones.
export type AppContextType = null | { dispatch: React.Dispatch<IAction>, handleDeleteTenant: Function };

//create a context to be used to pass handlers like delete, edit handlers to subcomponents.
//We are also going to pass dispatch returned by useReducer.
export const AppContext = React.createContext<AppContextType>(null);