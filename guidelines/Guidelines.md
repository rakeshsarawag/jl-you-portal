**Add your own guidelines here**
<!--

System Guidelines

Use this file to provide the AI with rules and guidelines you want it to follow.
This template outlines a few examples of things you can add. You can add your own sections and format it to suit your needs

TIP: More context isn't always better. It can confuse the LLM. Try and add the most important rules you need

# General guidelines

Any general rules you want the AI to follow.
For example:

* Only use absolute positioning when necessary. Opt for responsive and well structured layouts that use flexbox and grid by default
* Refactor code as you go to keep code clean
* Keep file sizes small and put helper functions and components in their own files.

--------------

# Design system guidelines
Rules for how the AI should make generations look like your company's design system

Additionally, if you select a design system to use in the prompt box, you can reference
your design system's components, tokens, variables and components.
For example:

* Use a base font-size of 14px
* Date formats should always be in the format “Jun 10”
* The bottom toolbar should only ever have a maximum of 4 items
* Never use the floating action button with the bottom toolbar
* Chips should always come in sets of 3 or more
* Don't use a dropdown if there are 2 or fewer options

You can also create sub sections and add more specific details
For example:


## Button
The Button component is a fundamental interactive element in our design system, designed to trigger actions or navigate
users through the application. It provides visual feedback and clear affordances to enhance user experience.

### Usage
Buttons should be used for important actions that users need to take, such as form submissions, confirming choices,
or initiating processes. They communicate interactivity and should have clear, action-oriented labels.

### Variants
* Primary Button
  * Purpose : Used for the main action in a section or page
  * Visual Style : Bold, filled with the primary brand color
  * Usage : One primary button per section to guide users toward the most important action
* Secondary Button
  * Purpose : Used for alternative or supporting actions
  * Visual Style : Outlined with the primary color, transparent background
  * Usage : Can appear alongside a primary button for less important actions
* Tertiary Button
  * Purpose : Used for the least important actions
  * Visual Style : Text-only with no border, using primary color
  * Usage : For actions that should be available but not emphasized
-->

### Must follow guidlines, Basic things to remember while working on this product

1. All the settings must be configurable like dropdown, fixed values etc and if user has access then only he can update the configuration
2. Use constants file for the product app wise so that it can be easy to update the constants at any time
3. All the texts must be available in the text file so that at later point of time it becomes easy to change the texts to another language
4. Without permission no one should be able to access the apps. apps must be under the roles
5. Full product must be covered through automation testing. Each feature of this app must be covered in the automation testing and keep this testing scripts seperate. Whenever any change is made, automation testing can be performed to confirm if the features are working or there is any regression.
6. Each feature of the product and it's apps must be documented properly so that it can be easy to refer. These documentation must be accessible to users if they already have access to that app. If app access is not given, user should not be able to access the documentation for that particular app.
7. If not required, user should only be able to access information which is available to him, he must not be able to see or access the information of other users
8. 