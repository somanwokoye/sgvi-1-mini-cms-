import { Injectable, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { User } from '../../users/models/user.entity';
import UserSearchBody from '../interfaces/userSearchBody.interface';
import UserSearchResult from '../interfaces/userSearchResult.interface'

@Injectable()
export default class UsersSearchService implements OnModuleInit {

    index = 'users'; //use index = '*' for all

    constructor(
        private elasticsearchService: ElasticsearchService
    ) { }

    async onModuleInit() {
        //await this.elasticsearchService.indices.delete({index: this.index}); //I used this during dev to delete so as to recreate index
        //create index with proper mappings that support completion, if not already created
        //check to see if the index already exists, else create with all the settings
        const checkIndex = await this.elasticsearchService.indices.exists({ index: this.index });
        if (checkIndex.statusCode === 404) {
            console.log('need to create index')
            try {
                await this.elasticsearchService.indices.create(
                    {
                        index: this.index,
                        body: {
                            mappings: {
                                properties: {
                                    suggestFullName: {
                                        type: "completion", //this field will be indexed for completion suggester
                                        analyzer: "simple" //default is simple. There are others
                                    },
                                    suggestFirstName: {
                                        type: "completion", //this field will be indexed for completion suggester
                                        analyzer: "simple" //default is simple. There are others
                                    },
                                    suggestLastName: {
                                        type: "completion", //this field will be indexed for completion suggester
                                        analyzer: "simple" //default is simple. There are others
                                    },
                                    suggestFullNameWithWeights: {
                                        type: "completion", //this field will be indexed for completion suggester
                                        analyzer: "simple" //default is simple. There are others
                                    },
                                    id: {
                                        type: "integer"
                                    },
                                    firstName: {
                                        type: "text"
                                    },
                                    lastName: {
                                        type: "text"
                                    },
                                    homeAddress: {
                                        type: "text"
                                    },
                                    landlord: {
                                        type: "boolean"
                                    }
                                }
                            }
                        }
                    }
                )
            } catch (error) {
                console.log(error.message)
            }
        }
    }

    /**
     * index a user
     * @param post 
     */
    async indexUser(user: User) {
        try {
            return await this.elasticsearchService.index<UserSearchResult, UserSearchBody>({
                index: this.index,
                body: {
                    //index the suggest field which was declared in the mapping. Include one or more field to look at for suggestion
                    suggestFullName: {
                        //input: [user.firstName, user.lastName, user.homeAddress ? user.homeAddress : '']//homeAddress has the possibility of being null, hence the tenary operator to check. No null is allowed
                        input: [`${user.firstName} ${user.lastName}`]
                    },
                    suggestFirstName: {
                        //input: [user.firstName, user.lastName, user.homeAddress ? user.homeAddress : '']//homeAddress has the possibility of being null, hence the tenary operator to check. No null is allowed
                        input: [user.firstName]
                    },
                    suggestLastName: {
                        //input: [user.firstName, user.lastName, user.homeAddress ? user.homeAddress : '']//homeAddress has the possibility of being null, hence the tenary operator to check. No null is allowed
                        input: [user.lastName]
                    },
                    suggestFullNameWithWeights: [ //this could apply to products with weights attached to make, name, model, etc?
                        {
                            input: user.firstName,
                            weight: 2
                        },
                        {
                            input: user.lastName,
                            weight: 1
                        },
                    ],
                    id: user.id, //useful for tracing the real user in User entity after search result returns
                    firstName: user.firstName,
                    lastName: user.lastName,
                    homeAddress: user.homeAddress,
                    landlord: user.landlord

                }
            })
        } catch (error) {
            console.log(error)
        }
    }

    /**
     * In the search function below, we have used elastic search's multi_match Query DSL (https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html)
     * There are so many other possibilities. See https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html
     * @param queryText 
     */
    async search(queryText: string) {
        try {
            const { body } = await this.elasticsearchService.search<UserSearchResult>({
                index: this.index, //to search through multiple indices use [this.index, 'product', '...'] or even ['my-index*']
                body: {
                    query: {
                        //Below is an example of multimatch query. We want to check through multiple fields as shown below. See https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html
                        multi_match: {
                            query: queryText,
                            fields: ['firstName', 'lastName'], //the optional ^ means multiply that field's score by that number
                            fuzziness: 'AUTO'
                        }
                        /*
                        //below is an example of match query with filter. See https://www.elastic.co/guide/en/elasticsearch/reference/current/query-filter-context.html#query-filter-context-ex
                        bool: {
                            must: [ //there may be one or more must matches. For such, each match string can be assembled in search form and sent as distinct query parameters to be passed here from the controller
                                {
                                    match:
                                    {
                                        firstName: queryText
                                    }
                                },
                                {
                                    match:
                                    {
                                        lastName: {
                                            query: 'Onobhayedo', //hardcoded Onobhayedo here, just for illustation. Should have been sent as a separate query parameter, picked up from search form
                                            fuzziness: 'AUTO' //this will help to accommodate spelling mistakes. See https://www.elastic.co/guide/en/elasticsearch/reference/current/common-options.html#fuzziness
                                        }
                                    }
                                }
                            ],
                            filter: {
                                term: { landlord: false }
                            }
                        }*/
                    }
                }
            })
            const hits = body.hits.hits;
            return hits.map((item) => item._source);
        } catch (error) {
            console.log(error)
        }
    }

    /**
         * See https://www.elastic.co/guide/en/elasticsearch/reference/current/search-suggesters.html#search-suggesters
         * The suggest request part is defined alongside the query part in a _search request. If the query part is left out, only suggestions are returned
         * @param queryText 
         */
    async suggest(queryText: string) {
        try {
            const { body } = await this.elasticsearchService.search<UserSearchResult>({
                index: this.index,
                body: {
                    suggest: {
                        'suggestFullName': { //needed, in case the person types more than just first or last name
                            prefix: queryText,
                            completion: {
                                field: 'suggestFullName', //name of the field that was mapped as completion field.
                                size: 5, //number of suggestions to return. Optional. Defaults to 5
                                skip_duplicates: false, //defaults to false. When set to true, it can be more resource intensive
                                fuzzy: { // if included, it means that you can have a typo in your search and still get results back. Resource intensive
                                    fuzziness: 'AUTO' //defaults to AUTO
                                },
                                analyzer: "simple", //defaults to what was used to index
                                //sort: "score" //not yet functional

                            }
                            //a lot more possibilities, including context. see https://www.elastic.co/guide/en/elasticsearch/reference/current/search-suggesters.html#context-suggester
                        },
                        'suggestFirstName': {
                            prefix: queryText,
                            completion: {
                                field: 'suggestFirstName', //name of the field that was mapped as completion field.
                                size: 5, //number of suggestions to return. Optional. Defaults to 5
                                skip_duplicates: false, //defaults to false. When set to true, it can be more resource intensive
                                fuzzy: { // if included, it means that you can have a typo in your search and still get results back. Resource intensive
                                    fuzziness: 'AUTO' //defaults to AUTO
                                },
                                analyzer: "simple", //defaults to what was used to index
                                //sort: "score" //not yet functional

                            }
                            //a lot more possibilities, including context. see https://www.elastic.co/guide/en/elasticsearch/reference/current/search-suggesters.html#context-suggester
                        },
                        'suggestLastName': {
                            prefix: queryText,
                            completion: {
                                field: 'suggestLastName', //name of the field that was mapped as completion field.
                                size: 5, //number of suggestions to return. Optional. Defaults to 5
                                skip_duplicates: false, //defaults to false. When set to true, it can be more resource intensive
                                fuzzy: { // if included, it means that you can have a typo in your search and still get results back. Resource intensive
                                    fuzziness: 'AUTO' //defaults to AUTO
                                },
                                analyzer: "simple", //defaults to what was used to index
                                //sort: "score" //not yet functional

                            }
                            //a lot more possibilities, including context. see https://www.elastic.co/guide/en/elasticsearch/reference/current/search-suggesters.html#context-suggester
                        }
                    }
                }
            })

            const suggestions = [];
            body.suggest.suggestFirstName[0].options.map((item) => {

                suggestions.push({
                    score: item._score, //sending score as well in case the client wants to sort with it
                    id: item._source.id,
                    firstName: item._source.firstName,
                    lastName: item._source.lastName,
                    homeAddress: item._source.homeAddress,
                    landlord: item._source.landlord
                });
            });
            body.suggest.suggestLastName[0].options.map((item) => {
                //const index = currentUsers!.findIndex((user) => user.id === action.payload!.id);
                if (suggestions.findIndex((suggestion) => suggestion.id === item._source.id) == -1) //not already added
                    suggestions.push({
                        score: item._score, //sending score as well in case the client wants to sort with it
                        id: item._source.id,
                        firstName: item._source.firstName,
                        lastName: item._source.lastName,
                        homeAddress: item._source.homeAddress,
                        landlord: item._source.landlord
                    });
            });
            body.suggest.suggestFullName[0].options.map((item) => {
                //const index = currentUsers!.findIndex((user) => user.id === action.payload!.id);
                if (suggestions.findIndex((suggestion) => suggestion.id === item._source.id) == -1) //if not already added
                    suggestions.push({
                        score: item._score, //sending score as well in case the client wants to sort with it
                        id: item._source.id,
                        firstName: item._source.firstName,
                        lastName: item._source.lastName,
                        homeAddress: item._source.homeAddress,
                        landlord: item._source.landlord
                    });
            });
            //console.log(suggestions)
            return suggestions;

        } catch (error) {
            console.log(error)
        }
    }

    /**
     * See https://www.elastic.co/guide/en/elasticsearch/reference/current/search-suggesters.html#search-suggesters
     * The suggest request part is defined alongside the query part in a _search request. If the query part is left out, only suggestions are returned
     * @param queryText 
     */
    async searchWithSuggest(queryText: string) {
        try {
            const { body } = await this.elasticsearchService.search<UserSearchResult>({
                index: this.index,
                body: {
                    /*
                    query: {
                        
                        //Below is an example of multimatch query. We want to check through multiple fields as shown below. See https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html
                        multi_match: { 
                            query: queryText,
                            fields: ['firstName', 'lastName'], //ensure that these fields are also indicated in indexUser for suggest indexing, if using completion suggester.
                            fuzziness: 2
                            
                        },
                        
                        /*
                        //below is an example of match query with filter. See https://www.elastic.co/guide/en/elasticsearch/reference/current/query-filter-context.html#query-filter-context-ex
                        bool: {
                            must: [ //there may be one or more must matches. For such, each match string can be assembled in search form and sent as distinct query parameters to be passed here from the controller
                                {
                                    match:
                                    {
                                        firstName: queryText
                                    }
                                },
                                {
                                    match:
                                    {
                                        lastName: {
                                            query: 'Onobhayedo', //hardcoded Onobhayedo here, just for illustation. Should have been sent as a separate query parameter, picked up from search form
                                            fuzziness: 'AUTO' //this will help to accommodate spelling mistakes. See https://www.elastic.co/guide/en/elasticsearch/reference/current/common-options.html#fuzziness
                                        }
                                    }
                                }
                            ],
                            filter: {
                                term: { landlord: false }
                            }
                        }*/
                    //},
                    suggest: {
                        'suggestFullName': {
                            prefix: queryText,
                            completion: {
                                field: 'suggestFullName', //name of the field that was mapped as completion field.
                                size: 5, //number of suggestions to return. Optional. Defaults to 5
                                skip_duplicates: false, //defaults to false. When set to true, it can be more resource intensive
                                fuzzy: { // if included, it means that you can have a typo in your search and still get results back. Resource intensive
                                    fuzziness: 1 //defaults to AUTO
                                },
                                analyzer: "simple", //defaults to what was used to index
                                //sort: "score" //not yet functional
                            }
                            //a lot more possibilities, including context. see https://www.elastic.co/guide/en/elasticsearch/reference/current/search-suggesters.html#context-suggester
                        }
                    }
                }
            })
            /*
            console.log(JSON.stringify(body))
            console.log(`No of suggestFullName = ${body.suggest.suggestFullName.length}`)
            console.log(`No of suggestFullName[0] options = ${body.suggest.suggestFullName[0].options.length}`)
            console.log(`suggestFullName[0] options in json = ${JSON.stringify(body.suggest.suggestFullName[0].options)}`)
            */
            const hits = body.hits.hits;
            return hits.map((item) => item._source);
        } catch (error) {
            console.log(error)
        }
    }

    /**
     * for deleting entries by id
     * @param userId 
     */
    async remove(userId: number) {
        try {
            this.elasticsearchService.deleteByQuery({
                index: this.index,
                body: {
                    query: {
                        match: {
                            id: userId
                        }
                    }
                }
            })
        } catch (error) {
            console.log(`index remove error: ${error.message}`)
        }
    }

    async update(user: User) {
        /*
        try {
            const newBody: UserSearchBody = {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                homeAddress: user.homeAddress,
                /* Adding below leads to update failure. It appears not necessary to update suggest. Still investigating. 
                //index the suggest field which was declared in the mapping
                suggestFullName: {
                    //input: [user.firstName, user.lastName, user.homeAddress ? user.homeAddress : '']//homeAddress has the possibility of being null, hence the tenary operator to check. No null is allowed
                    input: [`${user.firstName} ${user.lastName}`]
                },
                suggestFirstName: {
                    //input: [user.firstName, user.lastName, user.homeAddress ? user.homeAddress : '']//homeAddress has the possibility of being null, hence the tenary operator to check. No null is allowed
                    input: [user.firstName]
                },
                suggestLastName: {
                    //input: [user.firstName, user.lastName, user.homeAddress ? user.homeAddress : '']//homeAddress has the possibility of being null, hence the tenary operator to check. No null is allowed
                    input: [user.lastName]
                },
                */
        //}

        /**
         * prepare the update script
         */
        /* const script = Object.entries(newBody).reduce((result, [key, value]) => {
             return `${result} ctx._source.${key}='${value}';`;
         }, '');

         return this.elasticsearchService.updateByQuery({
             index: this.index,
             body: {
                 query: {
                     term: {
                         id: user.id,
                     }
                 },
                 script: {
                     inline: script
                 }
             }
         })
     } catch (error) {
         console.log(error)
     }*/
        try { //alternative to above which seems not to work well with suggest index
            await this.remove(user.id) //remove
            await this.indexUser(user) //index again
        } catch (error) {
            console.log(error.message)
        }
    }

}